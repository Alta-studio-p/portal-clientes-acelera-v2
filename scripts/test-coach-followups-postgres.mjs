import assert from 'node:assert/strict';
import {createSqlClient} from '../lib/postgres.mjs';
import {receiveCoachFollowup,enqueueCoachFollowups,completeCoachFollowup} from '../lib/coach-followup-store.mjs';
import {deliverCoachFollowups} from '../lib/coach-followup-mail.mjs';

const sql=createSqlClient();
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rollback=Error('rollback fixtures');
try{
  await sql.transaction(async tx=>{
    for(const table of ['coach_followup_settings','coach_followups','claude_summary_jobs'])await tx.query(`create temporary table ${table} (like private.${table} including defaults including constraints including indexes) on commit drop`);
    await tx.query('create temporary table coaches(id uuid primary key,email text,full_name text,alternate_emails text[],bills_by_call boolean,fathom_source_key text,is_active boolean) on commit drop');
    await tx.query('create temporary table clients(id uuid primary key,email text,full_name text,alternate_emails text[]) on commit drop');
    await tx.query('create temporary table calls(id uuid primary key,client_id uuid,coach_id uuid,fathom_call_id text,discarded_at timestamptz,coach_needs_confirmation boolean) on commit drop');
    const db=async(strings,...values)=>tx.query(strings.reduce((q,s,i)=>q+(i?`$${i}`:'')+s,'').replace(/(?:private|public)\./g,'pg_temp.'),values);
    db.transaction=fn=>fn(db);
    await db`insert into private.coach_followup_settings(singleton,enabled,starts_at) values(true,true,now()-interval '1 day')`;
    await db`insert into public.coaches values(${uid(1)}::uuid,'coach@example.test','Coach',array[]::text[],true,'alex',true)`;
    await db`insert into public.clients values(${uid(2)}::uuid,'client@example.test','Cliente',array[]::text[])`;
    const meeting={recording_id:123,title:'Sesión ficticia',recorded_by:{email:'coach@example.test'},calendar_invitees:[{email:'client@example.test',name:'Cliente'}],
      recording_start_time:new Date(Date.now()-3600000).toISOString(),recording_end_time:new Date(Date.now()-600000).toISOString(),share_url:'https://fathom.video/share/fixture',
      default_summary:{markdown_formatted:'Se trabajaron ejemplos para la entrevista.'},transcript:[
        {speaker:{display_name:'Coach',matched_calendar_invitee_email:'coach@example.test'},text:'Propongo preparar dos ejemplos para la siguiente sesión. También revisamos los resultados de tu proyecto y practicamos cómo explicar tu contribución, con contexto, acciones y resultados específicos.'},
        {speaker:{display_name:'Cliente',matched_calendar_invitee_email:'client@example.test'},text:'Me comprometo a preparar dos ejemplos para la siguiente sesión. Me interesa practicar las respuestas y mostrar el resultado de mi trabajo con claridad y de forma breve.'},
      ]};
    assert.equal((await receiveCoachFollowup(db,'alex','event',meeting)).accepted,true);
    assert.equal((await receiveCoachFollowup(db,'alex','event',meeting)).accepted,true);
    assert.equal((await receiveCoachFollowup(db,'alex','other-recording',{...meeting,recording_id:456})).accepted,true);
    assert.equal((await db`select count(*)::int n from private.coach_followups`)[0].n,1);
    await enqueueCoachFollowups(db);await enqueueCoachFollowups(db);
    const [job]=await db`select * from private.claude_summary_jobs`;
    assert.equal((await db`select count(*)::int n from private.claude_summary_jobs`)[0].n,1);
    const result={session_kind:'coaching',recap:[{text:'Practicamos ejemplos para una entrevista.',evidence:[{ref:'S',quote:'Se trabajaron ejemplos para la entrevista.'}]}],
      agreements:[{task:'Preparar dos ejemplos.',owner:'client',deadline:null,evidence:[{ref:'T2',quote:'Me comprometo a preparar dos ejemplos para la siguiente sesión.'}]}],next_session:[],preparation:[],coach_feedback:[]};
    assert.equal((await completeCoachFollowup(db,job,result)).status,200);
    let sends=0;
    const transport={verify:async()=>{},close:()=>{},sendMail:async message=>{sends++;assert.deepEqual(message.envelope.to,['coach@example.test']);return {accepted:['coach@example.test']};}};
    assert.equal((await deliverCoachFollowups(db,{transportFactory:()=>transport})).sent,1);
    assert.equal((await deliverCoachFollowups(db,{transportFactory:()=>transport})).sent,0);assert.equal(sends,1);
    assert.equal((await db`select status from private.coach_followups`)[0].status,'sent');
    throw rollback;
  });
}catch(error){if(error!==rollback)throw error;}finally{await sql.end();}
console.log('PASS: PostgreSQL webhook → queue → result → one mocked email. All writes used temporary tables and were rolled back.');
