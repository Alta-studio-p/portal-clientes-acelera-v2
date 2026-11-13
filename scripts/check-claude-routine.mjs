import {createSqlClient} from '../lib/postgres.mjs';
import {newJobToken,tokenHash,summaryHash,SUMMARY_ORIGIN,SUMMARY_PATH} from '../lib/claude-summary.mjs';

if(!process.argv.includes('--start')) {
  console.log('Usa --start para enviar un único texto ficticio a la nueva rutina. No procesa clientes.');
  process.exit(0);
}
const sql=createSqlClient();
try {
  const token=newJobToken();
  const snapshot={title:'Prueba sintética',display_title:'Prueba sintética',summary:'Meeting Purpose\n\nReview a fictional CV and prepare for a fictional interview.\n\nKey Takeaways\n\n- Practice concise answers.\n- Use clear examples.',next_steps:'Next Steps\n\n- Prepare one example for the next practice session.'};
  const [job]=await sql`insert into private.claude_summary_jobs(fixture,source_hash,snapshot,token_hash,expires_at)
    values(true,${summaryHash(snapshot)},${JSON.stringify(snapshot)}::jsonb,${tokenHash(token)},now()+interval '1 hour') returning id::text`;
  const response=await fetch(`${SUMMARY_ORIGIN}${SUMMARY_PATH}?job=${job.id}`,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'start'}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`Synthetic dispatch HTTP ${response.status}`);
  const started=await response.json();
  console.log(JSON.stringify({fixture:job.id,dispatch:started.status}));
  if(started.status!=='started')throw Error('Synthetic routine did not start');
  for(let attempt=0;attempt<60;attempt++) {
    const [result]=await sql`select status,error_code,result from private.claude_summary_jobs where id=${job.id}::uuid`;
    if(result.status==='success'){console.log(JSON.stringify({fixture:job.id,status:'success',keys:Object.keys(result.result),clientWrites:0}));process.exitCode=0;break;}
    if(['error','expired','obsolete'].includes(result.status))throw Error(`Synthetic routine ${result.status}: ${result.error_code||'unknown'}`);
    if(attempt===59)throw Error('Synthetic routine still pending; check Claude usage limits. No production call was changed.');
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
} finally {await sql.end();}
