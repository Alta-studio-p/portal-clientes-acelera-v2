import {normalizeEmail,matchClient} from './client-matching.mjs';
import {resolveCallCoach} from './coach-attribution.mjs';
import {followupInput,followupHash,validateFollowup} from './coach-followup.mjs';
import {masterclassFathomUrl} from './masterclasses.mjs';

export async function receiveCoachFollowup(sql,sourceKey,webhookId,meeting) {
  if(!Number.isSafeInteger(meeting?.recording_id)||meeting.recording_id<=0||!Array.isArray(meeting.transcript)||meeting.transcript.length>20000||!Array.isArray(meeting.calendar_invitees)||meeting.calendar_invitees.length>500)return {status:400};
  const startedAt=meeting.recording_start_time,endedAt=meeting.recording_end_time;
  const start=Date.parse(startedAt),end=Date.parse(endedAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end>Date.now()+300000)return {status:400};
  return sql.transaction(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext(${`coach-followup:${meeting.recording_id}`}))`;
    const [settings]=await tx`select enabled,starts_at from private.coach_followup_settings where singleton`;
    if(!settings?.enabled||start<new Date(settings.starts_at).getTime())return {status:200,accepted:false};
    const [existing]=await tx`select id from private.coach_followups where recording_id=${String(meeting.recording_id)}`;
    if(existing)return {status:200,accepted:true};
    const coaches=await tx`select id::text,email,full_name,alternate_emails,bills_by_call,fathom_source_key from public.coaches where is_active`;
    const clients=await tx`select id::text,email,full_name,alternate_emails from public.clients`;
    const sourceCoach=coaches.find(c=>c.fathom_source_key===sourceKey);
    const recorderEmail=normalizeEmail(meeting.recorded_by?.email);
    const sourceEmails=sourceCoach?[sourceCoach.email,...(sourceCoach.alternate_emails??[])].map(normalizeEmail):[];
    // Only own-recording webhooks are registered; shared recordings never authorize delivery.
    if(!sourceCoach||!recorderEmail||!sourceEmails.includes(recorderEmail))return {status:200,accepted:false};
    const speakerEmails=meeting.transcript.map(t=>t.speaker?.matched_calendar_invitee_email).filter(Boolean);
    const attribution=resolveCallCoach({recordedByEmail:recorderEmail,speakerEmails,coaches});
    const coach=coaches.find(c=>c.id===attribution.coachId);
    const matched=matchClient({invitees:meeting.calendar_invitees,title:meeting.meeting_title||meeting.title},clients);
    const client=['email','alt_email'].includes(matched.method)?matched.client:null;
    const [call]=await tx`select id::text,client_id::text,coach_id::text,discarded_at,coach_needs_confirmation from public.calls where fathom_call_id=${String(meeting.recording_id)}`;
    if(!client||!coach||attribution.needsConfirmation||!normalizeEmail(coach.email)||call&&(call.discarded_at||call.coach_needs_confirmation||call.client_id!==client.id||call.coach_id!==coach.id))return {status:200,accepted:false};
    const input=followupInput(meeting,client,coach);
    if(!input.transcript.some(t=>t.speaker==='client')||!input.transcript.some(t=>t.speaker==='coach')||input.transcript.reduce((n,t)=>n+t.text.length,0)<200)return {status:200,accepted:false};
    await tx`insert into private.coach_followups(recording_id,source_key,webhook_id,client_id,coach_id,call_id,started_at,recording_url,snapshot,recipient_email)
      values(${String(meeting.recording_id)},${sourceKey},${webhookId},${client.id}::uuid,${coach.id}::uuid,${call?.id??null}::uuid,${startedAt}::timestamptz,${masterclassFathomUrl(meeting.share_url??'')},${JSON.stringify({input})}::jsonb,${normalizeEmail(coach.email)})`;
    return {status:200,accepted:true};
  });
}

export async function enqueueCoachFollowups(sql) {
  const [settings]=await sql`select enabled from private.coach_followup_settings where singleton`;
  if(!settings?.enabled)return;
  await sql.transaction(async tx=>{
    const rows=await tx`select * from private.coach_followups where status='pending' order by created_at limit 3 for update skip locked`;
    for(const row of rows){
      const [job]=await tx`insert into private.claude_summary_jobs(call_id,source_hash,snapshot,task)
        values(null,${followupHash(row.snapshot.input)},${JSON.stringify({input:row.snapshot.input,followup_id:row.id})}::jsonb,'coach_followup') returning id`;
      await tx`update private.coach_followups set job_id=${job.id}::uuid,status='queued' where id=${row.id}::uuid`;
    }
  });
}

export async function completeCoachFollowup(tx,job,result) {
  let validated;
  try{validated=validateFollowup(job.snapshot.input,result);}catch{return {status:422};}
  if(!job.fixture){
    const [followup]=await tx`select * from private.coach_followups where job_id=${job.id}::uuid for update`;
    if(!followup||followup.status!=='queued')return {status:409};
    await tx`update private.coach_followups set result=${JSON.stringify(validated)}::jsonb,status=${validated.session_kind==='coaching'?'ready':'skipped'} where id=${followup.id}::uuid`;
  }
  await tx`update private.claude_summary_jobs set status='success',result=${JSON.stringify(validated)}::jsonb,finished_at=now() where id=${job.id}::uuid`;
  return {status:200};
}
