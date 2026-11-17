import nodemailer from 'nodemailer';
import {normalizeEmail} from './client-matching.mjs';
import {followupMessage,validateFollowup} from './coach-followup.mjs';

export const WORKSPACE_SENDER='admin@joinaceleratalent.com';
export function workspaceTransport(password=process.env.GOOGLE_WORKSPACE_APP_PASSWORD) {
  if(!password||!String(password).replace(/\s/g,'').match(/^[a-zA-Z]{16}$/))throw Error('workspace_not_configured');
  return nodemailer.createTransport({
    host:'smtp.gmail.com',port:465,secure:true,auth:{user:WORKSPACE_SENDER,pass:password.replace(/\s/g,'')},
    tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:12000,greetingTimeout:12000,socketTimeout:20000,
    disableFileAccess:true,disableUrlAccess:true,
  });
}

export async function testWorkspaceMail(sql,job) {
  if(!job.fixture||job.task!=='coach_followup'||job.status!=='success')return {status:409};
  let transport;
  try{transport=workspaceTransport();await transport.verify();}catch{return {status:503};}
  try{
    // A fixture token permits exactly one test, always addressed to the fixed sender.
    const claimed=await sql`update private.claude_summary_jobs set token_hash=null where id=${job.id}::uuid and fixture and task='coach_followup' and status='success' and token_hash=${job.token_hash} returning id`;
    if(!claimed.length)return {status:409};
    const sent=await transport.sendMail({from:WORKSPACE_SENDER,to:WORKSPACE_SENDER,envelope:{from:WORKSPACE_SENDER,to:[WORKSPACE_SENDER]},subject:'Acelera · Prueba de seguimiento por correo',
      text:'La conexión de Google Workspace del portal funciona. Esta prueba es ficticia y no contiene información de clientes. El envío automático todavía requiere activación.'});
    return {status:sent.accepted?.map(normalizeEmail).includes(WORKSPACE_SENDER)?200:503};
  }catch{return {status:503};}finally{transport.close();}
}

export async function deliverCoachFollowups(sql,{transportFactory=workspaceTransport}={}) {
  const [settings]=await sql`select enabled from private.coach_followup_settings where singleton`;
  if(!settings?.enabled)return {status:'disabled',sent:0};
  let transport;
  try{transport=transportFactory();await transport.verify();}catch{return {status:'mail_not_ready',sent:0};}
  let sent=0;
  try {
    // SMTP cannot guarantee idempotency after DATA: ambiguous deliveries require review, not a blind retry.
    await sql`update private.coach_followups set status='uncertain',error_code='delivery_unconfirmed' where status='sending' and sending_at<now()-interval '20 minutes'`;
    for(let i=0;i<3;i++) {
      const item=await sql.transaction(async tx=>{
        const [row]=await tx`select f.*,co.email as coach_email,co.is_active,cl.full_name as client_name,
          c.id::text as current_call_id,c.client_id::text as current_client_id,c.coach_id::text as current_coach_id,c.discarded_at,c.coach_needs_confirmation
          from private.coach_followups f join public.coaches co on co.id=f.coach_id join public.clients cl on cl.id=f.client_id
          left join public.calls c on c.fathom_call_id=f.recording_id
          where (f.status='ready' or f.status='error' and f.retry_at<=now()) and f.attempts<3
          order by f.created_at limit 1 for update of f skip locked`;
        if(!row)return null;
        const email=normalizeEmail(row.coach_email);
        if(!row.is_active||!email||email!==row.recipient_email||row.current_call_id&&(row.discarded_at||row.coach_needs_confirmation||row.current_client_id!==row.client_id||row.current_coach_id!==row.coach_id)){
          await tx`update private.coach_followups set status='blocked',error_code='recipient_or_assignment_changed' where id=${row.id}::uuid`;
          return {blocked:true};
        }
        await tx`update private.coach_followups set status='sending',sending_at=now(),attempts=attempts+1 where id=${row.id}::uuid`;
        return {...row,email};
      });
      if(!item)break;
      if(item.blocked)continue;
      try{
        const result=validateFollowup(item.snapshot.input,item.result);
        if(result.session_kind!=='coaching')throw Error('not_coaching');
        const message=followupMessage(result,{clientName:item.client_name,startedAt:item.started_at,truncated:item.snapshot.input.transcript_truncated});
        const receipt=await transport.sendMail({
          from:{name:'Acelera Talent · Seguimiento',address:WORKSPACE_SENDER},to:[{address:item.email}],
          envelope:{from:WORKSPACE_SENDER,to:[item.email]},messageId:`<followup-${item.id}@joinaceleratalent.com>`,
          subject:message.subject,text:message.text,attachments:[{filename:'seguimiento-para-cliente.txt',content:message.clientText,contentType:'text/plain; charset=utf-8'}],
        });
        if(!receipt.accepted?.map(normalizeEmail).includes(item.email))throw Error('delivery_unconfirmed');
        await sql`update private.coach_followups set status='sent',sent_at=now(),error_code=null where id=${item.id}::uuid and status='sending'`;
        sent++;
      }catch(error){
        const safeToRetry=error?.code==='EAUTH'||error?.command==='CONN';
        await sql`update private.coach_followups set status=${safeToRetry?'error':'uncertain'},retry_at=now()+interval '30 minutes',error_code=${safeToRetry?'smtp_pre_delivery_failure':'delivery_unconfirmed'} where id=${item.id}::uuid and status='sending'`;
      }
    }
  }finally{transport.close();}
  return {status:'ok',sent};
}
