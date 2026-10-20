import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const script = new URL("translate-call-texts-es.mjs", import.meta.url).href;
const fixture = `
  import assert from 'node:assert/strict';
  let callsPages = 0;
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(options.method === 'PATCH', false, 'Existing profile was overwritten');
    const u = new URL(url);
    if (u.pathname.endsWith('/clients')) return Response.json([{id:'client',context_summary:'Perfil manual'}]);
    if (u.pathname.endsWith('/calls')) {
      callsPages++;
      if (u.searchParams.get('offset') === '0') return Response.json(Array.from({length:1000},(_,i)=>({id:String(i),summary:'Resumen en espanol'})));
      assert.equal(u.searchParams.get('offset'),'1000');
      return Response.json([]);
    }
    throw Error('Unexpected network request');
  };
  await import(${JSON.stringify(script)});
  process.on('beforeExit',()=>assert.equal(callsPages,2,'Calls pagination was incomplete'));
`;
const result = spawnSync(process.execPath, ["--input-type=module", "-e", fixture, "--", "--apply"], {
  cwd: tmpdir(), encoding: "utf8",
  env: {...process.env, NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY:"fixture", LLM_API_KEY:"fixture"},
});
assert.equal(result.status, 0, result.stderr);
console.log("PASS: existing client profiles preserved and all calls pages read");

const generatedFixture = `
  import assert from 'node:assert/strict';
  import {contextFromCall} from ${JSON.stringify(new URL("../lib/call-context.mjs", import.meta.url).href)};
  const english={id:'english',title:'Sesion',summary:'Meeting Purpose: original',next_steps:null,started_at:'2026-10-01'};
  const spanish={id:'spanish',title:'Sesion',display_title:'Titulo manual',summary:'Resumen manual en espanol',next_steps:'Next steps: follow up'};
  let savedEnglish=english,callWrites=0,contextWrites=0;
  globalThis.fetch=async(url,options={})=>{
    const u=new URL(url),table=u.pathname.split('/').at(-1);
    if(table==='completions')return Response.json({choices:[{message:{content:JSON.stringify({display_title:'Titulo nuevo',summary:'Resumen traducido',next_steps:'Dar seguimiento'})}}]});
    if(options.method==='PATCH'){
      const patch=JSON.parse(options.body);
      if(table==='calls'){
        callWrites++;
        if(u.searchParams.get('id')==='eq.spanish'){
          assert.equal(patch.summary,spanish.summary);assert.equal(patch.display_title,spanish.display_title);assert.equal(patch.next_steps,'Dar seguimiento');
        }else{assert.equal(patch.summary,'Resumen traducido');savedEnglish={...english,...patch};}
      }else{
        contextWrites++;assert.equal(u.searchParams.get('id'),'eq.generated');
        assert.equal(patch.context_summary,contextFromCall(savedEnglish));
      }
      return new Response(null,{status:204});
    }
    if(table==='clients')return Response.json([
      {id:'manual',context_source_call_id:'english',context_summary:contextFromCall(english)+'\\nNota manual'},
      {id:'generated',context_source_call_id:'english',context_summary:contextFromCall(english)}
    ]);
    if(table==='calls')return Response.json(u.searchParams.has('client_id')?[savedEnglish]:[english,spanish]);
    throw Error('Unexpected request');
  };
  await import(${JSON.stringify(script)});
  process.on('beforeExit',()=>{assert.equal(callWrites,2);assert.equal(contextWrites,1);});
`;
const translated = spawnSync(process.execPath, ["--input-type=module", "-e", generatedFixture, "--", "--apply"], {
  cwd: tmpdir(), encoding: "utf8",
  env: {...process.env, NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY:"fixture", LLM_API_KEY:"fixture", TRANSLATE_ES_DELAY_MS:"0"},
});
assert.equal(translated.status, 0, translated.stderr);
console.log("PASS: Spanish edits preserved; only untouched generated profiles refreshed");
