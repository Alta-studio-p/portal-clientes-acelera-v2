import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { insightSource,redactCoachingText,validateInsight,insightRequest,requestInsight,DEFAULT_INSIGHT_MODEL } from '../lib/coaching-insights.mjs';
import { generateClientInsight } from '../lib/coaching-insight-store.mjs';

const client={full_name:'María Fernández',names:['Alex Vega']};
const calls=[{id:'a',started_at:'2026-11-01',summary:'María Fernández revisó su CV con Alex Vega. Correo maria@example.com. Se acordó mejorar los logros. https://drive.google.com/private',next_steps:'María debe preparar tres logros.'}];
const source=insightSource(client,calls);
const valid=()=>({objective:{text:'Mejorar el CV.',sources:['S1']},overview:{text:'Se revisó el CV.',sources:['S1']},advances:[],blockers:[],pending:[],topics:[],recommendations:[{topic:'cv',action:'Revisar los logros preparados.',reason:'Se acordó prepararlos.',sources:['S1']}],evolution:[{source:'S1',change:'Se revisó el CV.',pending:['Preparar tres logros.']}]});

test('only anonymized summaries and next steps leave the application',()=>{
  const payload=JSON.stringify(insightRequest(source));
  for(const privateValue of ['María','Fernández','Alex','Vega','maria@example.com','drive.google.com'])assert.ok(!payload.includes(privateValue));
  assert.equal(insightRequest(source).provider.data_collection,'deny');
  assert.equal(insightRequest(source).provider.max_price.completion,0.4);
  assert.match(redactCoachingText('Llamar +57 310 123 4567'),/teléfono/);
  assert.ok(!redactCoachingText('MARIA Fernandez con José y Li. josé@example.com',['María Fernández','Jose','Li']).match(/maria|fernandez|josé|\bLi\b|@/i));
});
test('fingerprint is stable across reads and ordering, but invalidates changed summaries',()=>{
  assert.equal(source.hash,insightSource(client,[...calls]).hash);
  assert.notEqual(source.hash,insightSource(client,[{...calls[0],summary:calls[0].summary+' Nuevo acuerdo.'}]).hash);
  assert.equal(insightSource(client,[{...calls[0],summary:'Resumen migrado desde Notion. Pendiente de sincronización.'}]).sessions.length,0);
  assert.equal(insightSource(client,[{...calls[0],started_at:'2026-11-02T02:00:00Z'}]).sessions[0].date,'2026-11-01');
});
test('evidence must exist and evolution must cover every included call',()=>{
  assert.equal(validateInsight(valid(),source).recommendations.length,1);
  const fake=valid();fake.recommendations[0].sources=['S99'];assert.throws(()=>validateInsight(fake,source),/evidence/);
  const missing=valid();missing.evolution=[];assert.throws(()=>validateInsight(missing,source),/coverage/);
});
test('unsupported recommendations are omitted, not displayed as facts',()=>{
  const sample=valid();sample.recommendations.push({topic:'linkedin',action:'Crear un perfil nuevo.',reason:'Consejo genérico sin evidencia.',sources:[]});
  sample.overview={text:'',sources:[]};
  const result=validateInsight(sample,source);
  assert.equal(result.recommendations.length,1);
  assert.equal(result.overview.text,'Se revisó el CV.');assert.deepEqual(result.overview.sources,['S1']);
});
test('provider errors, malformed and truncated output never become an insight',async()=>{
  await assert.rejects(()=>requestInsight(source,{apiKey:'test',fetchImpl:async()=>new Response('',{status:429})}),/provider_429/);
  await assert.rejects(()=>requestInsight(source,{apiKey:'test',fetchImpl:async()=>Response.json({choices:[{finish_reason:'length'}]})}),/incomplete/);
  const result=await requestInsight(source,{apiKey:'test',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(JSON.parse(options.body).model,DEFAULT_INSIGHT_MODEL);
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(valid())}}],usage:{prompt_tokens:500,completion_tokens:500,cost:0.00025}});
  }});assert.equal(result.usage.cost,0.00025);
});
test('missing key, cache, busy client and exhausted daily budget make no paid request',async()=>{
  for(const status of ['cached','busy','budget','paused']){
    let paid=0;
    const sql=async(strings)=>{
      const q=strings.join('?');
      if(q.includes('select c.full_name'))return [client];
      if(q.includes('from public.client_sessions'))return calls;
      if(q.includes('from private.coaching_insights'))return status==='cached'?[{id:'cached'}]:[];
      if(q.includes('where error_code in'))return status==='paused'?[{id:'paused'}]:[];
      if(q.includes('from private.coaching_insight_attempts where client_id'))return status==='busy'?[{id:'busy'}]:[];
      if(q.includes('sum(reservation)'))return [{spent:'0.50'}];
      return [];
    };
    sql.transaction=async work=>work(sql);
    const result=await generateClientInsight(sql,'client',{apiKey:'test',fetchImpl:async()=>{paid++;throw Error('unexpected');}});
    assert.equal(result.status,{cached:'cached',busy:'recent_attempt',budget:'daily_budget',paused:'provider_cooldown'}[status]);assert.equal(paid,0);
  }
  assert.equal((await generateClientInsight(null,'client',{apiKey:''})).status,'missing_key');
});
test('staff authorization and client isolation remain in server boundaries',async()=>{
  const auth=await fs.readFile(new URL('../lib/data/coaching-insights.ts',import.meta.url),'utf8');
  assert.match(auth,/requireRole\(\['admin','coach'\]\)/);assert.match(auth,/co\.profile_id=\$\{session.userId\}/);
  for(const file of ['../app/portal/page.tsx','../app/preview/clients/[id]/page.tsx'])assert.ok(!(await fs.readFile(new URL(file,import.meta.url),'utf8')).includes('StaffClientWorkspace'));
  const sql=await fs.readFile(new URL('../supabase-coaching-insights.sql',import.meta.url),'utf8');assert.match(sql,/revoke all[\s\S]*authenticated,service_role/);
});
