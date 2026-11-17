import {readFile} from 'node:fs/promises';
import {createSqlClient} from '../lib/postgres.mjs';
import {fathomSourcesFromEnv} from '../lib/fathom-api.mjs';

if(!process.argv.includes('--apply'))throw Error('Usa --apply para preparar el seguimiento privado. Agrega --register para conectar Fathom o --enable después de probar el correo.');
const sql=createSqlClient();
try{
  await sql.query(await readFile(new URL('../supabase-coach-followups.sql',import.meta.url),'utf8'));
  if(process.argv.includes('--register')){
    const sources=fathomSourcesFromEnv();
    if(!sources.length)throw Error('No hay fuentes de Fathom configuradas.');
    let failures=0;
    for(const source of sources){
      try{
      const [hook]=await sql`insert into private.fathom_followup_hooks(source_key) values(${source.key})
        on conflict(source_key) do update set source_key=excluded.source_key returning id,provider_id,active`;
      if(hook.provider_id){if(!hook.active)throw Error(`${source.key}: creación anterior sin confirmar. Revisa Fathom antes de reintentar.`);console.log(`${source.key}: webhook ya registrado`);continue;}
      await sql`update private.fathom_followup_hooks set provider_id=${`registration_pending:${hook.id}`} where id=${hook.id}::uuid`;
      const response=await fetch('https://api.fathom.ai/external/v1/webhooks',{
        method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'X-Api-Key':source.apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({destination_url:`https://portal-clientes-acelera-v2.vercel.app/api/internal/fathom-followup?hook=${hook.id}`,
          triggered_for:['my_recordings','my_shared_with_team_recordings'],include_transcript:true,include_summary:true,include_action_items:true,include_crm_matches:false}),
      });
      if(!response.ok){
        if(response.status>=400&&response.status<500)await sql`update private.fathom_followup_hooks set provider_id=null where id=${hook.id}::uuid`;
        throw Error(`Fathom ${source.key}: HTTP ${response.status}. No se reintentó crear el webhook.`);
      }
      const created=await response.json();
      if(typeof created.id!=='string'||typeof created.secret!=='string'||!created.secret.startsWith('whsec_'))throw Error(`Fathom ${source.key}: respuesta no válida. Revisa el webhook antes de reintentar.`);
      await sql`update private.fathom_followup_hooks set provider_id=${created.id},signing_secret=${created.secret},active=true where id=${hook.id}::uuid`;
      console.log(`${source.key}: webhook registrado, secreto guardado sin mostrarlo`);
      }catch(error){failures++;console.error(`${source.key}: ${error.message}`);}
    }
    if(failures)throw Error(`${failures} fuente(s) requieren revisión. Las demás se conservaron.`);
  }
  if(process.argv.includes('--enable')){
    const [count]=await sql`select count(*)::int total from private.fathom_followup_hooks where active`;
    if(!count.total)throw Error('Primero registra los webhooks.');
    await sql`update private.coach_followup_settings set enabled=true,starts_at=case when enabled then starts_at else now() end where singleton`;
    console.log('Seguimiento activado solo para sesiones nuevas. No se envían correos históricos.');
  }else console.log('Seguimiento preparado; activación sin cambios.');
}finally{await sql.end();}
