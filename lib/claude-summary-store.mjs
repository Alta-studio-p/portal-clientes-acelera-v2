import { contextFromCall } from './call-context.mjs';
import { SUMMARY_ORIGIN, SUMMARY_PATH, SUMMARY_INSTRUCTIONS, SUMMARY_SCHEMA, hasEnglishSignals, summaryInput, summaryHash, tokenHash, secretMatches, summaryPatch, routineUrl, newJobToken } from './claude-summary.mjs';

export async function authorizeSummaryJob(sql, id, authorization) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '') || !authorization.startsWith('Bearer ')) return null;
  const [job] = await sql`select * from private.claude_summary_jobs where id=${id}::uuid and expires_at>now()`;
  return job && secretMatches(tokenHash(authorization.slice(7)),job.token_hash) ? job : null;
}

export async function startSummaryJob(sql, id, {fetchImpl=fetch, fixture=false}={}) {
  const url = routineUrl(process.env.CLAUDE_SUMMARY_FIRE_URL);
  const key = process.env.CLAUDE_SUMMARY_FIRE_TOKEN;
  if (!key) throw Error('missing_configuration');
  const token = newJobToken();
  const job = await sql.transaction(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext('claude-summary-dispatch-v1'))`;
    const [count] = await tx`select count(*)::int as total from private.claude_summary_jobs where dispatched_at>now()-interval '24 hours'`;
    const [active] = await tx`select count(*)::int as total from private.claude_summary_jobs where status in ('starting','running','uncertain') and expires_at>now()`;
    if (Number(count.total)>=20 || Number(active.total)>=3) return null;
    const [claimed] = await tx`update private.claude_summary_jobs set status='starting',token_hash=${tokenHash(token)},expires_at=now()+interval '6 hours',dispatched_at=now(),attempts=attempts+1
      where id=${id}::uuid and fixture=${fixture} and status='pending' and attempts<2 returning *`;
    return claimed;
  });
  if (!job) return {status:'not_started'};
  const callback = `${SUMMARY_ORIGIN}${SUMMARY_PATH}?job=${job.id}`;
  try {
    // No HTTP retry: the fire API has no idempotency key and a timeout may already have started a run.
    const response = await fetchImpl(url, {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(25000),
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','anthropic-version':'2026-10-21'},
      body:JSON.stringify({text:JSON.stringify({payload_url:callback,callback_url:callback,authorization:`Bearer ${token}`})}),
    });
    if (!response.ok) {
      await sql`update private.claude_summary_jobs set status='error',error_code=${`provider_${response.status}`},finished_at=now(),token_hash=null where id=${id}::uuid and status='starting'`;
      return {status:'error',code:`provider_${response.status}`};
    }
    const data = await response.json();
    if (data.type !== 'routine_fire' || typeof data.claude_code_session_id !== 'string') throw Error('invalid_provider_response');
    await sql`update private.claude_summary_jobs set status='running',session_id=${data.claude_code_session_id} where id=${id}::uuid and status='starting'`;
    return {status:'started'};
  } catch {
    await sql`update private.claude_summary_jobs set status='uncertain',error_code='dispatch_unconfirmed' where id=${id}::uuid and status='starting'`;
    return {status:'uncertain'};
  }
}

export async function dispatchSummaries(sql) {
  if (process.env.CLAUDE_SUMMARIES_ENABLED !== '1') return {status:'disabled',started:0};
  routineUrl(process.env.CLAUDE_SUMMARY_FIRE_URL);
  if (!process.env.CLAUDE_SUMMARY_FIRE_TOKEN) throw Error('missing_configuration');
  // A paid subscription limit is shared with interactive use. Pause on an explicit provider refusal.
  const paused = await sql`select id from private.claude_summary_jobs where error_code in ('provider_429','provider_403','provider_401') and dispatched_at>now()-interval '6 hours' limit 1`;
  if (paused.length) return {status:'provider_cooldown',started:0};
  await sql`update private.claude_summary_jobs set status='expired',token_hash=null,finished_at=now(),error_code='result_timeout' where status in ('starting','running','uncertain') and expires_at<=now()`;
  await sql`update private.claude_summary_jobs set status='pending',error_code=null where status in ('error','expired') and not fixture and attempts<2 and dispatched_at<now()-interval '24 hours'`;
  const calls = await sql`select id::text,title,display_title,summary,next_steps from public.calls
    where summary is not null or next_steps is not null order by started_at desc nulls last,id limit 10000`;
  for (const call of calls) {
    if (![call.summary,call.next_steps,call.display_title].some(hasEnglishSignals)) continue;
    if (JSON.stringify(summaryInput(call)).length>180000) continue;
    await sql`insert into private.claude_summary_jobs(call_id,source_hash,snapshot) values(${call.id}::uuid,${summaryHash(call)},${JSON.stringify(summaryInput(call))}::jsonb) on conflict(call_id,source_hash) do nothing`;
  }
  const jobs = await sql`select id::text from private.claude_summary_jobs where status='pending' and not fixture order by created_at,id limit 3`;
  let started=0;
  for (const job of jobs) {
    const result=await startSummaryJob(sql,job.id);
    if (result.status==='started') started++;
    else return {status:result.status,started};
  }
  return {status:'ok',started};
}

export function summaryPayload(job) {
  return {task:'translate_call',instructions:SUMMARY_INSTRUCTIONS,schema:SUMMARY_SCHEMA,input:job.snapshot};
}

export async function completeSummaryJob(sql, id, authorization, result) {
  return sql.transaction(async tx => {
    await tx`select id from private.claude_summary_jobs where id=${id}::uuid for update`;
    const job=await authorizeSummaryJob(tx,id,authorization);
    if (!job) return {status:401};
    if (job.status==='success') return {status:200};
    if (!['starting','running','uncertain'].includes(job.status)) return {status:409};
    let patch;
    try { patch=summaryPatch(job.snapshot,result); } catch { return {status:422}; }
    if (!job.fixture) {
      if (!job.call_id) return {status:409};
      const [call]=await tx`select id::text,client_id::text,title,started_at,display_title,summary,next_steps from public.calls where id=${job.call_id}::uuid for update`;
      if (!call || summaryHash(call)!==job.source_hash) {
        await tx`update private.claude_summary_jobs set status='obsolete',finished_at=now() where id=${id}::uuid`;
        return {status:409};
      }
      await tx`update public.calls set display_title=${patch.display_title},summary=${patch.summary},next_steps=${patch.next_steps} where id=${job.call_id}::uuid`;
      if (call.client_id) {
        const previous=contextFromCall(call);
        const updated=contextFromCall({...call,...patch});
        // Only replace the exact generated context; a manually edited profile is never touched.
        await tx`update public.clients set context_summary=${updated},context_generated_at=now()
          where id=${call.client_id}::uuid and context_source_call_id=${call.id}::uuid and context_summary=${previous}`;
      }
    }
    await tx`update private.claude_summary_jobs set status='success',result=${JSON.stringify(patch)}::jsonb,finished_at=now() where id=${id}::uuid`;
    return {status:200};
  });
}
