import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {summaryPatch,summaryHash,summaryInput,tokenHash,secretMatches,routineUrl} from '../lib/claude-summary.mjs';
import {authorizeSummaryJob,completeSummaryJob,startSummaryJob,summaryPayload} from '../lib/claude-summary-store.mjs';

const id='00000000-0000-4000-8000-000000000001';
const callId='00000000-0000-4000-8000-000000000002';
const input={title:'Sesión',display_title:'Título manual',summary:'Meeting Purpose\n\nReview the CV and interview preparation. https://example.invalid/recording',next_steps:null};
const translated={display_title:'Otro título',summary:'Propósito de la reunión\n\nRevisar la hoja de vida y la preparación de la entrevista. https://example.invalid/recording',next_steps:null};
function fixture({stale=false,status='running',fixture=false}={}) {
  const job={id,call_id:callId,fixture,status,snapshot:summaryInput(input),source_hash:summaryHash(input),token_hash:tokenHash('fixture-token')};
  const writes=[];
  const sql=async(strings,...values)=>{
    const query=strings.join('?');
    if(query.includes('count(*)'))return [{total:0}];
    if(query.includes('select * from private.claude_summary_jobs')){assert.match(query,/expires_at>now\(\)/);return [job];}
    if(query.includes('select id from private.claude_summary_jobs'))return [{id}];
    if(query.includes('from public.calls'))return [{...input,id:callId,client_id:null,...(stale?{summary:'Edición manual posterior'}:{})}];
    if(query.includes('pg_advisory_xact_lock'))return [];
    if(query.includes("set status='starting'")){job.status='starting';return [job];}
    if(query.startsWith('update ')||query.trim().startsWith('update ')){writes.push({query,values});return [];}
    throw Error(`Unexpected query: ${query}`);
  };
  sql.transaction=work=>work(sql);
  return {sql,job,writes};
}

test('result contract preserves Spanish edits, nulls, Markdown, links and source hashes',()=>{
  const patch=summaryPatch(input,translated);
  assert.equal(patch.display_title,input.display_title);
  assert.equal(patch.summary,translated.summary);
  assert.equal(patch.next_steps,null);
  assert.notEqual(summaryHash(input),summaryHash({...input,summary:'Editado'}));
  for(const bad of [{},null,{...translated,extra:true},{...translated,summary:null},{...translated,summary:'Meeting Purpose'},{...translated,summary:'Resumen'}])assert.throws(()=>summaryPatch(input,bad));
  assert.throws(()=>summaryPatch(input,{...translated,summary:translated.summary.replace('https://example.invalid/recording','')}));
  assert.throws(()=>summaryPatch({...input,summary:'# Meeting Purpose\n\n- Review the fictional CV carefully.'},{...translated,summary:'Propósito de la reunión: revisar cuidadosamente la hoja de vida ficticia.'}));
});

test('routine fire URL and secrets cannot be redirected or compared loosely',()=>{
  assert.equal(secretMatches('Bearer a','Bearer a'),true);
  assert.equal(secretMatches('Bearer b','Bearer a'),false);
  assert.equal(secretMatches('',''),false);
  assert.equal(routineUrl('https://api.anthropic.com/v1/claude_code/routines/trig_fixture/fire'),'https://api.anthropic.com/v1/claude_code/routines/trig_fixture/fire');
  for(const value of ['http://api.anthropic.com/v1/claude_code/routines/trig_fixture/fire','https://evil.invalid/fire','https://user:pass@api.anthropic.com/v1/claude_code/routines/trig_fixture/fire','https://api.anthropic.com/v1/claude_code/routines/trig_fixture/fire?q=1'])assert.throws(()=>routineUrl(value));
});

test('wrong job tokens cannot retrieve data or save results',async()=>{
  const {sql,writes}=fixture();
  assert.equal(await authorizeSummaryJob(sql,id,'Bearer wrong'),null);
  assert.equal(await authorizeSummaryJob(sql,'invalid','Bearer fixture-token'),null);
  assert.equal((await completeSummaryJob(sql,id,'Bearer wrong',translated)).status,401);
  assert.equal(writes.length,0);
});

test('stale callbacks cannot overwrite edited call content',async()=>{
  const {sql,writes}=fixture({stale:true});
  assert.equal((await completeSummaryJob(sql,id,'Bearer fixture-token',translated)).status,409);
  assert.equal(writes.some(w=>w.query.includes('update public.calls')),false);
  assert.equal(writes.some(w=>w.query.includes("status='obsolete'")),true);
});

test('valid results update only the snapshotted call; duplicate callbacks are idempotent',async()=>{
  const {sql,writes}=fixture();
  assert.equal((await completeSummaryJob(sql,id,'Bearer fixture-token',translated)).status,200);
  const callWrite=writes.find(w=>w.query.includes('update public.calls'));
  assert.deepEqual(callWrite.values,[input.display_title,translated.summary,null,callId]);
  const duplicate=fixture({status:'success'});
  assert.equal((await completeSummaryJob(duplicate.sql,id,'Bearer fixture-token',translated)).status,200);
  assert.equal(duplicate.writes.length,0);
});

test('synthetic verification never modifies a client call',async()=>{
  const {sql,job,writes}=fixture({fixture:true});
  assert.equal(summaryPayload(job).input.summary,input.summary);
  assert.equal((await completeSummaryJob(sql,id,'Bearer fixture-token',translated)).status,200);
  assert.equal(writes.some(w=>w.query.includes('public.calls')||w.query.includes('public.clients')),false);
});

test('a dispatch timeout never triggers an HTTP retry',async()=>{
  const oldUrl=process.env.CLAUDE_SUMMARY_FIRE_URL,oldKey=process.env.CLAUDE_SUMMARY_FIRE_TOKEN;
  process.env.CLAUDE_SUMMARY_FIRE_URL='https://api.anthropic.com/v1/claude_code/routines/trig_fixture/fire';
  process.env.CLAUDE_SUMMARY_FIRE_TOKEN='fixture-provider-key';
  let requests=0;
  try {
    const {sql,writes}=fixture({status:'pending'});
    const result=await startSummaryJob(sql,id,{fetchImpl:async(url,options)=>{
      requests++;
      assert.equal(options.redirect,'error');
      const payload=JSON.parse(JSON.parse(options.body).text);
      assert.equal(new URL(payload.callback_url).origin,'https://portal-clientes-acelera-v2.vercel.app');
      throw Error('timeout');
    }});
    assert.equal(result.status,'uncertain');assert.equal(requests,1);
    assert.ok(writes.some(w=>w.query.includes("status='uncertain'")));
  } finally {
    if(oldUrl===undefined)delete process.env.CLAUDE_SUMMARY_FIRE_URL;else process.env.CLAUDE_SUMMARY_FIRE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.CLAUDE_SUMMARY_FIRE_TOKEN;else process.env.CLAUDE_SUMMARY_FIRE_TOKEN=oldKey;
  }
});

test('daily translation defaults to Claude with no OpenRouter request',()=>{
  const script=new URL('./translate-call-texts-es.mjs',import.meta.url).href;
  const code=`import assert from 'node:assert/strict';let count=0;globalThis.fetch=async(url,options)=>{count++;assert.equal(url,'https://portal-clientes-acelera-v2.vercel.app/api/internal/claude-summary');assert.equal(options.headers.Authorization,'Bearer fixture');return Response.json({ok:true,status:'ok',started:1});};await import(${JSON.stringify(script)});process.on('beforeExit',()=>assert.equal(count,1));`;
  const run=spawnSync(process.execPath,['--input-type=module','-e',code,'--','--apply'],{cwd:tmpdir(),encoding:'utf8',env:{...process.env,SUMMARY_PROVIDER:'claude-routine',CRON_SECRET:'fixture',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'}});
  assert.equal(run.status,0,run.stderr);
  const schema=readFileSync(new URL('../supabase-claude-summaries.sql',import.meta.url),'utf8');
  assert.match(schema,/revoke all.*from public,anon,authenticated,service_role/);
});
