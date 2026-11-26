import {classificationHash,classificationInput,classificationTranscript,classificationResult,automaticNoShow} from './call-classification.mjs';
import {masterclassFathomUrl} from './masterclasses.mjs';

export async function enqueueClassifications(sql){
  if(process.env.CLAUDE_CLASSIFICATION_ENABLED==='0')return;
  const calls=await sql`select c.*,cl.full_name as client_name,co.full_name as coach_name,(co.fathom_source_key='caro') as coach_is_caro
    from public.calls c left join public.clients cl on cl.id=c.client_id left join public.coaches co on co.id=c.coach_id
    where c.discarded_at is null and c.classification_override_at is null and c.source='fathom'
      and c.started_at between now()-interval '90 days' and now()
      and (c.client_id is null or c.summary is null or co.fathom_source_key='caro')
    order by (c.summary is null) desc,c.started_at desc,c.id limit 200`;
  if(!calls.length)return;
  const jobs=await sql`select call_id::text,source_hash from private.claude_summary_jobs where task='classify_call' and call_id=any(${calls.map(c=>c.id)}::uuid[])`;
  const known=new Set(jobs.map(j=>`${j.call_id}:${j.source_hash}`));let inserted=0;
  for(const call of calls){
    const hash=classificationHash(call);if(known.has(`${call.id}:${hash}`))continue;
    const transcript=!call.summary?await classificationTranscript(call.share_url):{};
    const snapshot={input:classificationInput(call,transcript)};
    const rows=await sql`insert into private.claude_summary_jobs(call_id,source_hash,snapshot,task)
      values(${call.id}::uuid,${hash},${JSON.stringify(snapshot)}::jsonb,'classify_call') on conflict(call_id,source_hash) do nothing returning id`;
    if(rows.length&&++inserted>=3)break;
  }
}

export async function completeClassification(tx,job,result){
  let value;
  try{value=classificationResult(job.snapshot.input,result);}catch{return {status:422};}
  if(job.fixture){
    await tx`update private.claude_summary_jobs set status='success',result=${JSON.stringify(value)}::jsonb,finished_at=now() where id=${job.id}::uuid`;
    return {status:200};
  }
  const [call]=await tx`select c.*,(co.fathom_source_key='caro') as coach_is_caro from public.calls c
    left join public.coaches co on co.id=c.coach_id where c.id=${job.call_id}::uuid for update of c`;
  if(!call||call.discarded_at||call.classification_override_at||classificationHash(call)!==job.source_hash){
    await tx`update private.claude_summary_jobs set status='obsolete',finished_at=now() where id=${job.id}::uuid`;
    return {status:409};
  }
  let applied=false;
  if(automaticNoShow(job.snapshot.input,value)){
    const [fee]=await tx`select id from public.coach_fees where call_id=${call.id}::uuid limit 1`;
    if(!fee){await tx`update public.calls set discarded_at=now(),discard_reason='no_show',discarded_by=null where id=${call.id}::uuid`;applied=true;}
  }
  const recording=masterclassFathomUrl(call.share_url??'');
  if(value.category==='caro_class'&&value.confidence>=0.9&&call.coach_is_caro&&recording&&call.started_at&&call.duration_seconds>=300&&call.duration_seconds<=28800){
    await tx`insert into public.masterclasses(title,description,status,starts_at,duration_minutes,category,fathom_url,source_call_id)
      values(${value.class_title},${value.class_description},'draft',${call.started_at},${Math.round(call.duration_seconds/60)},'ai',${recording},${call.id}::uuid)
      on conflict(source_call_id) do nothing`;
  }
  await tx`insert into private.call_classifications(call_id,source_hash,job_id,result,applied_at)
    values(${call.id}::uuid,${job.source_hash},${job.id}::uuid,${JSON.stringify(value)}::jsonb,${applied?new Date().toISOString():null}::timestamptz)
    on conflict(call_id,source_hash) do nothing`;
  await tx`update private.claude_summary_jobs set status='success',result=${JSON.stringify(value)}::jsonb,finished_at=now() where id=${job.id}::uuid`;
  return {status:200};
}
