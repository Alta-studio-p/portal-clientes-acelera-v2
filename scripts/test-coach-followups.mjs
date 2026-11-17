import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyFathomSignature,followupInput,validateFollowup,followupMessage} from '../lib/coach-followup.mjs';
import {receiveCoachFollowup,completeCoachFollowup,enqueueCoachFollowups} from '../lib/coach-followup-store.mjs';
import {deliverCoachFollowups,workspaceTransport,WORKSPACE_SENDER} from '../lib/coach-followup-mail.mjs';

const secret='whsec_'+Buffer.from('fixture-secret-never-production').toString('base64');
const stamp=String(Math.floor(Date.now()/1000)),raw='{"recording_id":123}',id='fixture-event';
const signature=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${stamp}.${raw}`).digest('base64');
const headers=new Headers({'webhook-id':id,'webhook-timestamp':stamp,'webhook-signature':`v1,${signature}`});
assert.equal(verifyFathomSignature(secret,headers,raw),true);
assert.equal(verifyFathomSignature(secret,headers,raw+' '),false);
assert.equal(verifyFathomSignature(secret,headers,raw,Date.now()+600000),false);
headers.set('webhook-signature','v1,short');assert.equal(verifyFathomSignature(secret,headers,raw),false);

const client={id:'client',full_name:'Ana Martinez',email:'client@example.test',alternate_emails:[]};
const coach={id:'coach',full_name:'Coach Nombre',email:'coach@example.test',fathom_source_key:'alex',alternate_emails:[],bills_by_call:true};
const meeting={recording_id:123,title:'Seguimiento',recorded_by:{email:coach.email},calendar_invitees:[{name:client.full_name,email:client.email}],
  recording_start_time:'2026-11-17T12:00:00Z',recording_end_time:'2026-11-17T13:00:00Z',share_url:'https://fathom.video/share/fixture',
  default_summary:{markdown_formatted:'Práctica de ejemplos profesionales para la entrevista. Se acordó preparar ejemplos.'},
  transcript:[
    {speaker:{display_name:coach.full_name,matched_calendar_invitee_email:coach.email},text:'Propongo que prepares dos ejemplos concretos antes de la siguiente sesión. Enfoquémonos primero en los resultados que quieres comunicar y después revisamos cómo estructurar cada respuesta.'},
    {speaker:{display_name:client.full_name,matched_calendar_invitee_email:client.email},text:'Sí, me comprometo a preparar dos ejemplos concretos. Me gustaría que la próxima sesión revisáramos cómo presentarlos en una entrevista y practicáramos juntos las respuestas.'},
  ]};
const input=followupInput(meeting,client,coach);
assert.equal(input.transcript[0].speaker,'coach');assert.equal(input.transcript[1].speaker,'client');
const ev={ref:'T2',quote:'me comprometo a preparar dos ejemplos concretos'};
const result={session_kind:'coaching',recap:[{text:'Trabajamos cómo presentar ejemplos concretos en una entrevista.',evidence:[{ref:'S',quote:'Práctica de ejemplos profesionales'}]}],
  agreements:[{task:'Preparar dos ejemplos concretos.',owner:'client',deadline:null,evidence:[ev]}],
  next_session:[{action:'Practicar las respuestas con esos ejemplos.',reason:'La sesión dejó pendiente revisar cómo presentarlos.',evidence:[ev]}],preparation:[],
  coach_feedback:[{observation:'Podrías convertir la propuesta en una pregunta para validar el foco.',alternative:'Pregunta qué ejemplo le resultaría más útil trabajar primero.',evidence:[{ref:'T1',quote:'Propongo que prepares dos ejemplos concretos'}]}]};
assert.deepEqual(validateFollowup(input,result),result);
assert.throws(()=>validateFollowup(input,{...result,coach_feedback:[{...result.coach_feedback[0],evidence:[ev]}]}));
assert.throws(()=>validateFollowup(input,{...result,agreements:[{...result.agreements[0],deadline:'mañana'}]}));
assert.throws(()=>validateFollowup(input,{...result,agreements:[{...result.agreements[0],evidence:[{ref:'S',quote:input.summary}]}]}));
assert.throws(()=>validateFollowup(input,{...result,session_kind:'no_show'}));
assert.throws(()=>validateFollowup(input,{...result,recap:[{text:'Escribe a otra@persona.test',evidence:[ev]}]}));
const message=followupMessage(result,{clientName:client.full_name,startedAt:meeting.recording_start_time});
assert(message.text.includes('PRIVADO PARA EL COACH'));assert(!message.clientText.includes(result.coach_feedback[0].observation));
assert(message.clientText.includes('Podríamos'));assert(message.clientText.includes('Tú: Preparar'));
assert.throws(()=>workspaceTransport('normal-password'));

function db(handler){const writes=[];const sql=async(strings,...values)=>{const q=strings.join('?');if(/^(insert|update)/.test(q.trim()))writes.push({q,values});return handler(q,values);};sql.transaction=fn=>fn(sql);return {sql,writes};}
let duplicate=false;
let t=db(q=>{
  if(q.includes('coach_followup_settings'))return [{enabled:true,starts_at:'2026-11-17T00:00:00Z'}];
  if(q.includes('select id from private.coach_followups'))return duplicate?[{id:'existing'}]:[];
  if(q.includes('from public.coaches'))return [coach];if(q.includes('from public.clients'))return [client];
  return [];
});
assert.equal((await receiveCoachFollowup(t.sql,'alex',id,meeting)).accepted,true);
assert(t.writes.some(w=>w.q.includes('insert into private.coach_followups')));
const n=t.writes.length;duplicate=true;
assert.equal((await receiveCoachFollowup(t.sql,'alex',id,meeting)).accepted,true);assert.equal(t.writes.length,n);
duplicate=false;
assert.equal((await receiveCoachFollowup(t.sql,'ross',id,meeting)).accepted,false);
assert.equal((await receiveCoachFollowup(t.sql,'alex',id,{...meeting,recorded_by:{email:'intruder@example.test'}})).accepted,false);
assert.equal((await receiveCoachFollowup(t.sql,'alex',id,{...meeting,calendar_invitees:[{name:client.full_name,email:'unknown@example.test'}]})).accepted,false);
t=db(q=>q.includes('coach_followup_settings')?[{enabled:false}]:[]);
assert.equal((await receiveCoachFollowup(t.sql,'alex',id,meeting)).accepted,false);
await enqueueCoachFollowups(t.sql);assert.equal(t.writes.length,0);
t=db(()=>[]);
assert.equal((await completeCoachFollowup(t.sql,{id:'fixture',fixture:true,snapshot:{input}},result)).status,200);
assert.equal(t.writes.length,1);assert(t.writes[0].q.includes('claude_summary_jobs'));

const delivery={id:'outbox',client_id:client.id,coach_id:coach.id,is_active:true,coach_email:coach.email,recipient_email:coach.email,client_name:client.full_name,started_at:meeting.recording_start_time,snapshot:{input},result};
let claimed=false,mailCount=0;
const mailDb=overrides=>db(q=>{
  if(q.includes('coach_followup_settings'))return [{enabled:true}];
  if(q.includes('select f.*')){if(claimed)return [];claimed=true;return [{...delivery,...overrides}];}
  return [];
});
let transport={verify:async()=>{},close:()=>{},sendMail:async m=>{
  mailCount++;assert.equal(m.from.address,WORKSPACE_SENDER);assert.deepEqual(m.envelope.to,[coach.email]);
  assert(!m.attachments[0].content.includes(result.coach_feedback[0].observation));return {accepted:[coach.email]};
}};
t=mailDb({});assert.equal((await deliverCoachFollowups(t.sql,{transportFactory:()=>transport})).sent,1);assert.equal(mailCount,1);
claimed=false;t=mailDb({coach_email:'different@example.test'});await deliverCoachFollowups(t.sql,{transportFactory:()=>transport});
assert.equal(mailCount,1);assert(t.writes.some(w=>w.q.includes("status='blocked'")));
claimed=false;t=mailDb({current_call_id:'call',current_client_id:'other',current_coach_id:coach.id});await deliverCoachFollowups(t.sql,{transportFactory:()=>transport});assert.equal(mailCount,1);
claimed=false;t=mailDb({});transport={...transport,sendMail:async()=>{throw Error('timeout after DATA');}};
await deliverCoachFollowups(t.sql,{transportFactory:()=>transport});
assert(t.writes.some(w=>w.values.includes('uncertain')));
console.log('PASS: signatures, replay window, grounded agreements, private feedback isolation, identities, duplicates, fixture safety, recipient checks and ambiguous SMTP delivery. No real email sent.');
