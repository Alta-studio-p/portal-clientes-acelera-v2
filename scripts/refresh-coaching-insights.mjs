import { createSqlClient } from '../lib/postgres.mjs';
import { refreshInsightBatch } from '../lib/coaching-insight-store.mjs';
if(!process.argv.includes('--apply')){
  console.log('Dry-run: no AI requests. Use --apply to refresh up to 20 clients, within the shared US$0.50 daily reservation cap.');
}else{
  const sql=createSqlClient();
  try{console.log(JSON.stringify(await refreshInsightBatch(sql)));}finally{await sql.end();}
}
