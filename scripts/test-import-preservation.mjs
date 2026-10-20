import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
const script=new URL('import-fathom-v2.mjs',import.meta.url).href;
for(const audit of [false,true]){
 const fixture=`
 import assert from 'node:assert/strict';
 const client={id:'client',full_name:'Fernando Godoy',email:'fgodoy.fernando@gmail.com',context_summary:'Manual context',start_date:'2026-10-01',end_date:'2027-12-01',status:'inactive'};
 const original={id:'call',fathom_call_id:'55',client_id:'client',coach_id:'original-coach',summary:'Resumen en espanol manual',next_steps:'Pasos manuales',started_at:'2020-01-01T00:00:00Z',raw_metadata:{source_key:'jota',manual_note:'preserve'}};
 let writes=0;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url); const table=u.pathname.split('/').at(-1);
  if(u.hostname==='api.fathom.ai')return Response.json({items:[{recording_id:55,title:'Onboarding Fernando Godoy',created_at:'2026-10-20T10:00:00Z',default_summary:{text:'New English summary'},calendar_invitees:[{name:'Fernando Godoy',email:client.email}]}],next_cursor:null});
  if(options.method==='PATCH')throw Error('Manual dates or context were overwritten');
  if(options.method==='POST'){
   writes++;assert.equal(${audit},false);
   const data=JSON.parse(options.body);
   if(table==='calls'){
    for(const key of ['client_id','coach_id','summary','next_steps'])assert.equal(key in data,false,key+' was overwritten');
    assert.equal(data.raw_metadata.manual_note,'preserve');assert.equal(data.raw_metadata.source_key,'jota');
    return Response.json([{...original,...data}]);
   }
   if(table==='coach_client_assignments'){assert.equal(data.coach_id,'original-coach');assert.equal(data.is_primary,false);assert.match(options.headers.Prefer,/ignore-duplicates/);}
   return new Response(null,{status:204});
  }
  if(table==='coaches')return Response.json([{id:'source-coach',fathom_source_key:'ross'}]);
  if(table==='clients')return Response.json([client]);
  if(table==='calls')return Response.json([original]);
  throw Error('Unexpected request');
 };
 await import(${JSON.stringify(script)});
 process.on('beforeExit',()=>assert.equal(writes>0,${!audit}));
 `;
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^FATHOM_|^BACKFILL_/.test(key)));
 Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture',FATHOM_SOURCE_ROSS_API_KEY:'fixture',FATHOM_AUDIT_ONLY:String(audit),FATHOM_SOURCE_DELAY_MS:'0'});
 const result=spawnSync(process.execPath,['--input-type=module','-e',fixture,'--','--apply'],{cwd:tmpdir(),encoding:'utf8',env});
 assert.equal(result.status,0,result.stderr);
 console.log('PASS: '+(audit?'audit performs no writes':'manual client, coach, summary, context and program settings preserved'));
}
