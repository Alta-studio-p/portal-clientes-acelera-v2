/* eslint-disable @typescript-eslint/no-require-imports -- This fixture uses Node's CommonJS loader to execute transpiled server modules. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let session = { userId: id(1), profile: { role: 'admin' } };
let db;
const file = path.join(root, 'lib/data/call-assignment.ts');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = Module._nodeModulePaths(root);
mod.require = name => {
  if (name === 'server-only') return {};
  if (name === '@/lib/db') return { getSql: () => db };
  if (name === '@/lib/auth') return { requireRole: async roles => {
    if (!session || !roles.includes(session.profile.role)) throw Error('denied');
    return session;
  } };
  return require(name);
};
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);

(async () => {
  const { createSqlClient } = await import('../lib/postgres.mjs');
  const sql = createSqlClient();
  const rollback = new Error('rollback test fixtures');
  let checks = 0;
  try {
    await sql.transaction(async tx => {
      // All production-qualified queries are redirected to connection-local temp tables.
      await tx.query(`create temporary table coaches (id uuid primary key, profile_id uuid, full_name text, email text) on commit drop`);
      await tx.query(`create temporary table clients (id uuid primary key, full_name text, email text) on commit drop`);
      await tx.query(`create temporary table calls (id uuid primary key, client_id uuid, coach_id uuid, title text, display_title text, started_at timestamptz, summary text, recording_url text, share_url text, raw_metadata jsonb,discarded_at timestamptz,discard_reason text,discarded_by uuid,classification_override_at timestamptz) on commit drop`);
      await tx.query(`create temporary table call_classifications(call_id uuid,result jsonb,created_at timestamptz) on commit drop`);
      await tx.query(`create temporary table masterclasses(id uuid,source_call_id uuid) on commit drop`);
      await tx.query(`create temporary table call_review_events(call_id uuid,action text,reason text,actor_id uuid,actor_role text) on commit drop`);
      const guard=fs.readFileSync(path.join(root,'supabase-call-review.sql'),'utf8').match(/create or replace function private\.preserve_discarded_call_assignment\(\)[\s\S]*?\$\$;/)[0].replaceAll('private.','pg_temp.');
      await tx.query(guard);
      await tx.query('create trigger preserve_discarded_call_assignment before update on pg_temp.calls for each row execute function pg_temp.preserve_discarded_call_assignment()');
      await tx.query(`create temporary table coach_client_assignments (id uuid default gen_random_uuid(), coach_id uuid, client_id uuid, is_primary boolean, unique(coach_id,client_id)) on commit drop`);
      await tx.query(`create temporary table coach_fees (id uuid default gen_random_uuid(), call_id uuid, client_id uuid) on commit drop`);
      const feeGuard=fs.readFileSync(path.join(root,'supabase-call-review.sql'),'utf8').match(/create or replace function private\.guard_discarded_call_fee\(\)[\s\S]*?\$\$;/)[0].replaceAll('private.','pg_temp.').replaceAll('public.','pg_temp.');
      await tx.query(feeGuard);
      await tx.query('create trigger guard_discarded_call_fee before insert or update on pg_temp.coach_fees for each row execute function pg_temp.guard_discarded_call_fee()');
      db = async (strings, ...values) => {
        const text = strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, '').replaceAll('public.', 'pg_temp.').replaceAll('private.','pg_temp.');
        return tx.query(text, values);
      };
      db.transaction = async work => {
        await tx.query('savepoint assignment_test');
        try { const value = await work(db); await tx.query('release savepoint assignment_test'); return value; }
        catch (error) { await tx.query('rollback to savepoint assignment_test'); await tx.query('release savepoint assignment_test'); throw error; }
      };
      await db`insert into public.coaches values (${id(10)},${id(2)},'Coach A','a@example.invalid'),(${id(11)},${id(3)},'Coach B','b@example.invalid')`;
      await db`insert into public.clients values (${id(20)},'Client A','a@example.invalid'),(${id(21)},'Client B','b@example.invalid'),(${id(22)},'Other client','c@example.invalid')`;
      await db`insert into public.coach_client_assignments (coach_id,client_id,is_primary) values (${id(10)},${id(20)},true),(${id(11)},${id(21)},true)`;
      for (const n of [30,31,32,33,34,35]) await db`insert into public.calls (id,coach_id,title,raw_metadata) values (${id(n)},${n === 31 ? id(11) : id(10)},'Call','{"manual_note":"keep"}'::jsonb)`;
      const { assignCallClient: assign, getCallAssignmentQueue: queue,reviewCallDisposition:review } = mod.exports;
      let result = await queue(); assert.equal(result.calls.length,6); assert.equal(result.clients.length,3); checks++;
      session = { userId: id(2), profile: { role:'coach' } };
      result = await queue(); assert.equal(result.calls.length,5); assert.ok(result.calls.every(c=>c.coach_id===id(10))); assert.deepEqual(result.clients.map(c=>c.id),[id(20)]); checks++;
      assert.equal((await assign(id(31),id(20))).success,false); checks++;
      assert.equal((await assign(id(30),id(21))).success,false); checks++;
      assert.equal((await assign(id(30),id(22))).success,false); checks++;
      assert.equal((await assign('invalid',id(20))).success,false); checks++;
      assert.equal((await assign(id(30),id(20))).success,true); checks++;
      const [saved] = await db`select * from public.calls where id=${id(30)}`;
      assert.equal(saved.client_id,id(20)); assert.equal(saved.raw_metadata.manual_note,'keep'); assert.equal(saved.raw_metadata.client_assignment.user_id,id(2)); checks++;
      const [primary] = await db`select is_primary from public.coach_client_assignments where coach_id=${id(10)} and client_id=${id(20)}`;
      assert.equal(primary.is_primary,true); checks++;
      assert.equal((await assign(id(30),id(20))).success,true); checks++;
      session = { userId:id(1), profile:{role:'admin'} };
      assert.equal((await assign(id(30),id(21))).success,false); checks++;
      assert.equal((await assign(id(32),id(22))).success,true); checks++;
      const [added] = await db`select is_primary from public.coach_client_assignments where coach_id=${id(10)} and client_id=${id(22)}`;
      assert.equal(added.is_primary,false); checks++;
      await db`insert into public.coach_fees (call_id,client_id) values (${id(33)},${id(21)})`;
      assert.equal((await assign(id(33),id(20))).success,false); checks++;
      await db`insert into public.coach_fees (call_id,client_id) values (${id(34)},null)`;
      assert.equal((await assign(id(34),id(20))).success,true);
      assert.equal((await db`select client_id from public.coach_fees where call_id=${id(34)}`)[0].client_id,id(20)); checks++;
      await tx.query(`create function pg_temp.reject_fee_update() returns trigger language plpgsql as $$begin raise exception 'fixture failure'; end$$`);
      await tx.query(`create trigger fail_fee before update on pg_temp.coach_fees for each row execute function pg_temp.reject_fee_update()`);
      await db`insert into public.coach_fees (call_id,client_id) values (${id(35)},null)`;
      await assert.rejects(assign(id(35),id(20)),/fixture failure/);
      assert.equal((await db`select client_id from public.calls where id=${id(35)}`)[0].client_id,null); checks++;
      await db`insert into public.calls(id,coach_id,summary,share_url) values(${id(36)},${id(10)},'Keep original summary','https://example.invalid/video'),(${id(37)},${id(11)},'Other coach',null)`;
      session={userId:id(2),profile:{role:'coach'}};
      assert.equal((await review(id(37),'discard','no_show')).success,false);checks++;
      assert.equal((await review(id(36),'discard','invalid')).success,false);checks++;
      assert.equal((await review(id(30),'discard','no_show')).success,true);
      assert.equal((await db`select client_id from public.calls where id=${id(30)}`)[0].client_id,id(20));
      assert.equal((await review(id(30),'restore','')).success,true);checks++;
      assert.equal((await review(id(33),'discard','no_show')).success,false);checks++;
      assert.equal((await review(id(36),'discard','no_show')).success,true);checks++;
      assert.equal((await assign(id(36),id(20))).success,false);checks++;
      const discarded=(await db`select * from public.calls where id=${id(36)}`)[0];
      assert.ok(discarded.discarded_at);assert.equal(discarded.summary,'Keep original summary');assert.equal(discarded.share_url,'https://example.invalid/video');checks++;
      await assert.rejects(db.transaction(write=>write`update public.calls set client_id=${id(20)},coach_id=${id(11)} where id=${id(36)}`),/discarded_call_assignment/);
      await db`update public.calls set coach_id=${id(11)} where id=${id(36)}`;
      const protectedCall=(await db`select client_id,coach_id from public.calls where id=${id(36)}`)[0];
      assert.equal(protectedCall.client_id,null);assert.equal(protectedCall.coach_id,id(10));checks++;
      await assert.rejects(db.transaction(write=>write`insert into public.coach_fees(call_id) values(${id(36)})`),/discarded_call_fee/);checks++;
      result=await queue();assert.ok(!result.calls.some(c=>c.id===id(36)));assert.ok(result.discardedCalls.some(c=>c.id===id(36)));checks++;
      assert.equal((await review(id(36),'discard','no_show')).success,true);
      assert.equal((await db`select count(*)::int as count from private.call_review_events where call_id=${id(36)}`)[0].count,1);checks++;
      session={userId:id(3),profile:{role:'coach'}};
      assert.equal((await review(id(36),'restore','')).success,false);checks++;
      session={userId:id(1),profile:{role:'admin'}};
      assert.equal((await review(id(36),'restore','')).success,true);checks++;
      assert.equal((await db`select discarded_at from public.calls where id=${id(36)}`)[0].discarded_at,null);
      assert.equal((await db`select count(*)::int as count from private.call_review_events where call_id=${id(36)}`)[0].count,2);checks++;
      for (const forbidden of [{userId:id(4),profile:{role:'client'}},null]) {
        session = forbidden;
        await assert.rejects(queue(),/denied/); await assert.rejects(assign(id(35),id(20)),/denied/);await assert.rejects(review(id(36),'discard','no_show'),/denied/); checks++;
      }
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.end(); }
  console.log(`PASS: ${checks} assignment checks, real PostgreSQL temp tables, auth mocked, no production records changed`);
})().catch(error => {console.error(error.message); process.exitCode=1;});
