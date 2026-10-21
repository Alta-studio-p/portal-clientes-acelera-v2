import assert from 'node:assert/strict';
import { createSqlClient } from '../lib/postgres.mjs';
import { issueClientInvitation, redeemClientInvitation } from '../lib/client-invitation.mjs';
const sql=createSqlClient();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const email='client@example.invalid';
const rollback=new Error('rollback fixtures');
let checks=0;
try{
 await sql.transaction(async tx=>{
  await tx.query(`create temporary table clients(id uuid primary key,profile_id uuid,email text) on commit drop`);
  await tx.query(`create temporary table profiles(id uuid primary key,email text,role text) on commit drop`);
  await tx.query(`create temporary table coaches(profile_id uuid,email text) on commit drop`);
  await tx.query(`create temporary table client_access_invitations(id uuid primary key default gen_random_uuid(),client_id uuid,profile_id uuid,email text,token_hash text unique,created_by uuid,created_at timestamptz default now(),expires_at timestamptz default (now()+interval '48 hours'),used_at timestamptz) on commit drop`);
  const db=async(strings,...values)=>tx.query(strings.reduce((s,p,i)=>s+(i?`$${i}`:'')+p,'').replaceAll('public.','pg_temp.'),values);
  db.transaction=async work=>work(db);
  await db`insert into public.clients values (${id(1)}::uuid,${id(2)}::uuid,${email})`;
  await db`insert into public.profiles values (${id(2)}::uuid,${email},'client')`;
  const options={clientId:id(1),profileId:id(2),email,origin:'https://example.invalid/auth/activate',createdBy:id(3)};
  const issue=()=>issueClientInvitation(db,options);
  let calls=0;
  const services={createAdminClient:async()=>({auth:{admin:{
   getUserById:async()=>({data:{user:{id:id(2),email}},error:null}),
   generateLink:async()=>{calls++;return {data:{user:{id:id(2)},properties:{hashed_token:'temporary'}},error:null};},
  }}}),createClient:async()=>({auth:{verifyOtp:async()=>({data:{user:{id:id(2)}},error:null})}})};
  const token=x=>new URLSearchParams(new URL(x.link).hash.slice(1)).get('token');
  const first=await issue();
  assert.equal((await db`select extract(epoch from expires_at-created_at)::int as seconds from public.client_access_invitations`)[0].seconds,172800);checks++;
  assert.equal((await db`select token_hash from public.client_access_invitations`)[0].token_hash.includes(token(first)),false);checks++;
  assert.equal((await redeemClientInvitation(db,'bad',services)).error!==null,true);assert.equal(calls,0);checks++;
  const second=await issue();assert((await redeemClientInvitation(db,token(first),services)).error);checks++;
  assert.equal((await redeemClientInvitation(db,token(second),services)).error,null);assert.equal(calls,1);checks++;
  assert((await redeemClientInvitation(db,token(second),services)).error);assert.equal(calls,1);checks++;
  const expired=await issue();await db`update public.client_access_invitations set expires_at=now()-interval '1 second' where used_at is null`;
  assert((await redeemClientInvitation(db,token(expired),services)).error);assert.equal(calls,1);checks++;
  const changed=await issue();await db`update public.clients set email='other@example.invalid'`;
  assert((await redeemClientInvitation(db,token(changed),services)).error);checks++;
  await db`update public.clients set email=${email}`;
  await db`update public.profiles set role='coach'`;
  assert((await redeemClientInvitation(db,token(changed),services)).error);checks++;
  await assert.rejects(issue(),/client_identity_conflict/);checks++;
  await db`update public.profiles set role='client'`;
  await db`insert into public.coaches values (${id(2)}::uuid,${email})`;
  assert((await redeemClientInvitation(db,token(changed),services)).error);checks++;
  await assert.rejects(issue(),/client_identity_conflict/);checks++;
  throw rollback;
 });
}catch(error){if(error!==rollback)throw error;}finally{await sql.end();}
console.log(`PASS: ${checks} managed invitation checks, real PostgreSQL temp tables; no real accounts or production changes`);
