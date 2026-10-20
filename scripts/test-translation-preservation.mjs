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
