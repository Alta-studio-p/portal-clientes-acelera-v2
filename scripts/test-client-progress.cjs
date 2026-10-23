/* eslint-disable @typescript-eslint/no-require-imports -- Isolated transpiled server-action tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let session = { userId:id(1), profile:{role:'admin'} };
let db;
function load(relative, extras = {}) {
  const file = path.join(root,relative);
  const mod = new Module(file,module);
  mod.filename=file; mod.paths=Module._nodeModulePaths(root);
  const mocks = {
    'server-only':{}, 'next/cache':{revalidatePath:()=>{}},
    '@/lib/db':{getSql:()=>db},
    '@/lib/auth':{requireRole:async roles=>{if (!session || !roles.includes(session.profile.role)) throw Error('denied'); return session;}},
    '@/lib/data/client-detail':{getCoachByProfileId:async userId=>userId===id(2)?{id:id(10)}:null}, ...extras,
  };
  mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
  return mod.exports;
}
const progress = load('lib/client-progress.ts');
const {saveProgressClient:save,manageProgressCategory:category,editProgressLabel:labels} = load('lib/actions/client-progress.ts',{'@/lib/client-progress':progress});
const {getStaffProgress:list} = load('lib/data/client-progress.ts');
const form = values => {const result=new FormData();for(const [key,value] of Object.entries(values))result.set(key,value);return result;};
const edit = (client,field,value) => save({error:null,success:false},form({clientId:client,field,value}));
const manage = (operation,label='',categoryId='') => category({error:null,success:false},form({operation,label,id:categoryId}));

(async()=>{
  assert.equal(progress.sessionProgress(0).percent,0);
  assert.equal(progress.sessionProgress(6).percent,50);
  assert.equal(progress.sessionProgress(12).percent,100);
  assert.equal(progress.sessionProgress(12).excess,0);
  assert.deepEqual(progress.sessionProgress(15),{sessions:15,percent:100,excess:3,remaining:0});
  for(const date of ['2026-02-30','2026-99-01','bad','1800-01-01','2025-02-29'])assert.equal(progress.validProgressDate(date),false);
  assert.equal(progress.validProgressDate('2024-02-29'),true);
  assert.match(progress.formatProgressDate('2026-08-04'),/^4 /);
  assert.match(progress.formatProgressDate('2026-08-04T02:00:00Z'),/^3 /);
  const {createSqlClient}=await import('../lib/postgres.mjs');
  const sql=createSqlClient(); const rollback=Error('fixture rollback');
  try {await sql.transaction(async tx=>{
    await tx.query(`create temporary table clients(id uuid primary key,full_name text,email text,start_date date,end_date date,updated_at timestamptz,status text default 'active') on commit drop`);
    await tx.query(`create temporary table coaches(id uuid primary key,profile_id uuid,full_name text,email text) on commit drop`);
    await tx.query(`create temporary table coach_client_assignments(client_id uuid,coach_id uuid) on commit drop`);
    await tx.query(`create temporary table client_sessions(id uuid primary key,client_id uuid,started_at timestamptz) on commit drop`);
    await tx.query(`create temporary table client_progress_categories(id uuid primary key default gen_random_uuid(),label text unique,active boolean default true) on commit drop`);
    await tx.query(`create temporary table client_progress_states(client_id uuid primary key,category_id uuid,updated_by uuid,updated_at timestamptz default now()) on commit drop`);
    await tx.query(`create temporary table client_progress_labels(client_id uuid,category_id uuid,updated_by uuid,updated_at timestamptz default now(),primary key(client_id,category_id)) on commit drop`);
    await tx.query(`create unique index on client_progress_categories(lower(trim(label)))`);
    let counter=0;
    async function scope(work){const name=`progress_test_${++counter}`;await tx.query(`savepoint ${name}`);try{const result=await work();await tx.query(`release savepoint ${name}`);return result;}catch(error){await tx.query(`rollback to savepoint ${name}`);await tx.query(`release savepoint ${name}`);throw error;}}
    db=async (strings,...values)=>scope(()=>tx.query(strings.reduce((s,part,i)=>s+(i?`$${i}`:'')+part,'').replaceAll('public.','pg_temp.'),values));
    db.transaction=work=>scope(()=>work(db));
    await db`insert into public.clients (id,full_name,email,start_date,end_date,updated_at) values (${id(20)},'Client A','a@example.invalid','2026-01-01','2026-04-01',now()),(${id(21)},'Client B','b@example.invalid','2026-02-01','2026-05-01',now())`;
    await db`insert into public.coaches values (${id(10)},${id(2)},'Coach A','a@example.invalid'),(${id(11)},${id(3)},'Coach B','b@example.invalid')`;
    await db`insert into public.coach_client_assignments values (${id(20)},${id(10)}),(${id(21)},${id(11)})`;
    await db`insert into public.client_sessions values (${id(30)},${id(20)},now())`;
    assert.equal((await list()).clients.length,2);
    assert.equal((await edit(id(21),'start','2026-03-01')).success,true);
    assert.equal((await edit(id(21),'start','2026-02-30')).success,false);
    assert.equal((await edit('bad','start','2026-03-01')).success,false);
    assert.equal((await manage('add','Pagado')).success,true);
    const [cat]=await db`select id::text from public.client_progress_categories where label='Pagado'`;
    assert.equal((await manage('add','Pagado')).success,false);
    session={userId:id(2),profile:{role:'coach'}};
    const coachList=await list(); assert.equal(coachList.clients.length,1);assert.equal(coachList.clients[0].id,id(20));assert.equal(coachList.isAdmin,false);
    // A forged preview coach parameter must not widen a real coach's access.
    assert.equal((await list(id(11))).clients[0].id,id(20));
    assert.equal((await edit(id(20),'start','2026-10-20')).success,true);
    assert.equal((await edit(id(21),'start','2026-10-20')).success,false);
    assert.equal((await edit(id(20),'category',cat.id)).success,true);
    await assert.rejects(manage('add','Unauthorized'),/denied/);
    const [client]=await db`select start_date::text,end_date::text from public.clients where id=${id(20)}`;
    assert.equal(client.start_date,'2026-10-20');assert.equal(client.end_date,'2026-04-01');
    session={userId:id(1),profile:{role:'admin'}};
    assert.equal((await manage('rename','Pago completo',cat.id)).success,true);
    assert.equal((await manage('archive','',cat.id)).success,true);
    assert.equal((await db`select category_id::text from public.client_progress_states where client_id=${id(20)}`)[0].category_id,cat.id);
    assert.equal((await edit(id(21),'category',cat.id)).success,false);
    assert.equal((await manage('restore','',cat.id)).success,true);
    assert.equal((await edit(id(21),'category',cat.id)).success,true);
    assert.equal((await edit(id(21),'category','')).success,true);
    const migration=fs.readFileSync(path.join(root,'scripts/sql/client-progress-labels.sql'),'utf8')
      .replace(/^begin;\s*/,'').replace(/commit;\s*$/,'').replaceAll('public.','pg_temp.');
    await tx.query(migration);
    assert.equal((await db`select count(*)::int as count from public.client_progress_labels where client_id=${id(20)}`)[0].count,1);
    session={userId:id(2),profile:{role:'coach'}};
    assert.equal((await labels(id(20),'create','Sin pagar')).success,true);
    assert.equal((await labels(id(20),'create','  sin   pagar  ')).success,true);
    const [newLabel]=await db`select id::text from public.client_progress_categories where label='Sin pagar'`;
    assert.equal((await db`select count(*)::int as count from public.client_progress_categories where lower(label)='sin pagar'`)[0].count,1);
    assert.equal((await labels(id(20),'add',cat.id)).success,true);
    assert.equal((await labels(id(20),'add',cat.id)).success,true);
    let multi=(await list()).clients[0];
    assert.equal(multi.operationalStatus,'active');
    assert.equal(multi.categoryIds.length,2);
    assert.equal((await labels(id(20),'remove',cat.id)).success,true);
    multi=(await list()).clients[0];
    assert.deepEqual(multi.categoryIds,[newLabel.id]);
    await tx.query(migration);
    assert.deepEqual((await list()).clients[0].categoryIds,[newLabel.id]);
    assert.equal((await labels(id(21),'create','Unauthorized label')).success,false);
    assert.equal((await db`select id from public.client_progress_categories where label='Unauthorized label'`).length,0);
    assert.equal((await labels(id(21),'add',newLabel.id)).success,false);
    assert.equal((await labels(id(20),'create','')).success,false);
    assert.equal((await labels(id(20),'create','x'.repeat(61))).success,false);
    session={userId:id(1),profile:{role:'admin'}};
    assert.equal((await manage('archive','',cat.id)).success,true);
    assert.equal((await labels(id(20),'add',cat.id)).success,false);
    for(const forbidden of [{userId:id(4),profile:{role:'client'}},null]){session=forbidden;await assert.rejects(list(),/denied/);await assert.rejects(edit(id(20),'start','2026-01-01'),/denied/);await assert.rejects(manage('add','Denied'),/denied/);await assert.rejects(labels(id(20),'create','Denied'),/denied/);}
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{await sql.end();}
  console.log('PASS: progress, valid dates, CRUD, retirement history, coach isolation and client denial; real PostgreSQL temp fixtures rolled back.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
