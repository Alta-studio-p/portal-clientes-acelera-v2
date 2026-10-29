import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createSqlClient} from '../lib/postgres.mjs';

const source=await readFile(new URL('../lib/data/complete-pending-invitation.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  .replace(/^import .*;\n/gm,'').replace('export async function','async function');
const sql=createSqlClient();const rollback=Error('fixture rollback');
const uid='00000000-0000-4000-8000-000000000001',cid='00000000-0000-4000-8000-000000000002',email='fixture@example.invalid';
try{
  await sql.transaction(async tx=>{
    await tx.query(`
      create temp table auth_users(id uuid primary key,email text,encrypted_password text default '',email_confirmed_at timestamptz,
        invited_at timestamptz default now(),last_sign_in_at timestamptz,deleted_at timestamptz,banned_until timestamptz,
        is_sso_user boolean default false,is_anonymous boolean default false,updated_at timestamptz,
        confirmation_token text default 'old-invite',recovery_token text default 'old-recovery',raw_user_meta_data jsonb);
      create temp table auth_identities(user_id uuid,provider text,identity_data jsonb default '{}',updated_at timestamptz);
      create temp table clients(id uuid,profile_id uuid,email text);
      create temp table profiles(id uuid,email text,role text);
      create temp table coaches(id uuid,profile_id uuid,email text);
    `);
    const db=(strings,...values)=>tx.query(strings.reduce((s,part,i)=>s+(i?`$${i}`:'')+part,'')
      .replaceAll('auth.users','pg_temp.auth_users').replaceAll('auth.identities','pg_temp.auth_identities').replaceAll('public.','pg_temp.'),values);
    const claim=new Function('getSql',`${code};return completePendingInvitation;`)(()=>db);
    async function reset(){
      await tx.query('truncate pg_temp.auth_users,pg_temp.auth_identities,pg_temp.clients,pg_temp.profiles,pg_temp.coaches');
      await tx.query('insert into pg_temp.auth_users(id,email) values($1,$2)',[uid,email]);
      await tx.query("insert into pg_temp.auth_identities(user_id,provider) values($1,'email')",[uid]);
      await tx.query('insert into pg_temp.clients values($1,$2,$3)',[cid,uid,email]);
      await tx.query("insert into pg_temp.profiles values($1,$2,'client')",[uid,email]);
    }
    await reset();
    assert.equal(await claim(uid,cid,email,'fixture-password-123'),true);
    const [saved]=await tx.query(`select encrypted_password=extensions.crypt($1,encrypted_password) valid_password,
      email_confirmed_at is not null confirmed,confirmation_token='' invite_cleared,recovery_token='' recovery_cleared from pg_temp.auth_users`,['fixture-password-123']);
    assert.equal(saved.valid_password,true);assert.equal(saved.confirmed,true);
    assert.equal(saved.invite_cleared,true);assert.equal(saved.recovery_cleared,true);
    assert.equal((await tx.query("select identity_data->>'email_verified' verified from pg_temp.auth_identities"))[0].verified,'true');
    assert.equal(await claim(uid,cid,email,'must-not-overwrite'),false);
    assert.equal((await tx.query('select encrypted_password=extensions.crypt($1,encrypted_password) valid from pg_temp.auth_users',['fixture-password-123']))[0].valid,true);
    for(const change of [
      "update pg_temp.auth_users set encrypted_password='existing-hash'",
      'update pg_temp.auth_users set email_confirmed_at=now()',
      'update pg_temp.auth_users set last_sign_in_at=now()',
      'update pg_temp.auth_users set invited_at=null',
      'update pg_temp.auth_users set banned_until=now()+interval \'1 day\'',
      "update pg_temp.profiles set role='admin'",
      "update pg_temp.profiles set email='other@example.invalid'",
      'update pg_temp.clients set profile_id=null',
      'insert into pg_temp.clients select gen_random_uuid(),profile_id,email from pg_temp.clients',
      'insert into pg_temp.coaches select gen_random_uuid(),id,email from pg_temp.profiles',
      'delete from pg_temp.auth_identities',
    ]){
      await reset();await tx.query(change);
      assert.equal(await claim(uid,cid,email,'must-not-overwrite'),false,change);
      assert.equal((await tx.query('select email_confirmed_at is not null confirmed from pg_temp.auth_users'))[0].confirmed,change.includes('email_confirmed_at=now()'));
    }
    throw rollback;
  });
}catch(error){if(error!==rollback)throw error;console.log('PASS: real PostgreSQL fixtures, bcrypt verification, same-account activation, one-time claim, protected existing passwords and eligibility guards. Rolled back; no real accounts changed.');}
finally{await sql.end();}
