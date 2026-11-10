import { DEFAULT_INSIGHT_MODEL, INSIGHT_VERSION, insightSource, insightRequest, requestInsight } from './coaching-insights.mjs';

export async function loadInsightSource(sql,clientId,model=DEFAULT_INSIGHT_MODEL) {
  const [client]=await sql`select c.full_name, coalesce((select jsonb_agg(co.full_name) from public.coaches co),'[]'::jsonb) as names from public.clients c where c.id=${clientId}::uuid`;
  if(!client)throw new Error('client_not_found');
  const calls=await sql`select s.id::text,s.started_at::text,s.summary,s.next_steps,
    coalesce((select jsonb_agg(p.name) from public.call_participants p where p.call_id=s.id),'[]'::jsonb) as names
    from public.client_sessions s where s.client_id=${clientId}::uuid order by s.started_at asc nulls last,s.id`;
  return insightSource(client,calls,model);
}

export async function readInsightBundle(sql,clientId,currentHash='') {
  const [versions,topics,recommendations]=await Promise.all([
    sql`select id::text,source_hash,model,source_call_ids,truncated,analysis,created_at::text,cost_usd from private.coaching_insights i where client_id=${clientId}::uuid
      and not exists(select 1 from jsonb_array_elements_text(i.source_call_ids) as source(id)
        where not exists(select 1 from public.client_sessions s where s.id::text=source.id and s.client_id=${clientId}::uuid))
      order by (source_hash=${currentHash}) desc,created_at desc limit 12`,
    sql`select topic,state,note,updated_at::text from private.coaching_topic_reviews where client_id=${clientId}::uuid`,
    sql`select recommendation_key,state,note,updated_at::text from private.coaching_recommendation_reviews where client_id=${clientId}::uuid`,
  ]);
  return {versions,topics,recommendations};
}

export async function generateClientInsight(sql,clientId,{model=DEFAULT_INSIGHT_MODEL,apiKey=process.env.OPENROUTER_API_KEY||process.env.LLM_API_KEY,fetchImpl=fetch}={}) {
  if(!apiKey)return {status:'missing_key'};
  const source=await loadInsightSource(sql,clientId,model);
  if(!source.sessions.length)return {status:'no_summaries'};
  insightRequest(source);
  const claim=await sql.transaction(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext('coaching-insights-budget-v1'))`;
    if((await tx`select id from private.coaching_insights where client_id=${clientId}::uuid and source_hash=${source.hash}`).length)return {status:'cached'};
    const paused=await tx`select id from private.coaching_insight_attempts where error_code in ('provider_429','provider_402','provider_401') and created_at>now()-interval '15 minutes' limit 1`;
    if(paused.length)return {status:'provider_cooldown'};
    const recent=await tx`select id from private.coaching_insight_attempts where client_id=${clientId}::uuid and
      ((status='processing' and created_at>now()-interval '5 minutes') or (source_hash=${source.hash} and created_at>now()-interval '15 minutes')) limit 1`;
    if(recent.length)return {status:'recent_attempt'};
    const [budget]=await tx`select coalesce(sum(reservation),0)::text as spent from private.coaching_insight_attempts
      where created_at >= date_trunc('day',now() at time zone 'America/Bogota') at time zone 'America/Bogota'`;
    if(Number(budget.spent)+0.02>0.5+1e-9)return {status:'daily_budget'};
    const [attempt]=await tx`insert into private.coaching_insight_attempts(client_id,source_hash,status) values(${clientId}::uuid,${source.hash},'processing') returning id::text`;
    return {status:'claimed',id:attempt.id};
  });
  if(claim.status!=='claimed')return claim;
  try {
    const result=await requestInsight(source,{apiKey,fetchImpl});
    return await sql.transaction(async tx=>{
      await tx`select id from public.clients where id=${clientId}::uuid for update`;
      const fresh=await loadInsightSource(tx,clientId,model);
      if(fresh.hash!==source.hash){
        await tx`update private.coaching_insight_attempts set status='obsolete',finished_at=now() where id=${claim.id}::uuid`;
        return {status:'obsolete'};
      }
      await tx`insert into private.coaching_insights(client_id,source_hash,model,prompt_version,source_call_ids,truncated,analysis,input_tokens,output_tokens,cost_usd)
        values(${clientId}::uuid,${source.hash},${source.model},${INSIGHT_VERSION},${JSON.stringify(source.callIds)}::jsonb,${source.truncated},${JSON.stringify(result.analysis)}::jsonb,${result.usage.input},${result.usage.output},${result.usage.cost}) on conflict(client_id,source_hash) do nothing`;
      await tx`update private.coaching_insight_attempts set status='success',finished_at=now() where id=${claim.id}::uuid`;
      return {status:'generated',cost:result.usage.cost};
    });
  } catch(error) {
    const safeCode=/^(provider_\d+|invalid_\w+|incomplete_output|duplicate_evidence|empty_recommendation)$/.test(error.message)?error.message:'generation_failed';
    await sql`update private.coaching_insight_attempts set status='error',error_code=${safeCode},finished_at=now() where id=${claim.id}::uuid`;
    return {status:'error',code:safeCode};
  }
}

export async function refreshInsightBatch(sql,{limit=20,deadlineMs=180000,...options}={}) {
  const candidates=await sql`select c.id::text from public.clients c where exists(select 1 from public.client_sessions s where s.client_id=c.id and length(s.summary)>40)
    order by (c.status='active') desc,(select max(s.started_at) from public.client_sessions s where s.client_id=c.id) desc nulls last,c.id limit 150`;
  const counts={generated:0,cached:0,skipped:0,errors:0};
  const started=Date.now();let attempted=0;
  for(const client of candidates){
    if(attempted>=limit||Date.now()-started>deadlineMs)break;
    try{
      const result=await generateClientInsight(sql,client.id,options);
      if(['daily_budget','missing_key','provider_cooldown'].includes(result.status))return {...counts,stopped:result.status};
      if(result.status==='cached')counts.cached++;
      else if(result.status==='generated'){counts.generated++;attempted++;}
      else if(result.status==='error'){
        counts.errors++;attempted++;
        if(result.code==='provider_429'||result.code==='provider_402'||result.code==='provider_401')return {...counts,stopped:result.code};
      }
      else counts.skipped++;
    }catch{counts.errors++;attempted++;}
  }
  return counts;
}
