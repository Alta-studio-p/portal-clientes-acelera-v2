import fs from 'node:fs/promises';
import { createSqlClient } from '../lib/postgres.mjs';
const sql=createSqlClient();
try{
  await sql.query(await fs.readFile(new URL('../supabase-coaching-insights.sql',import.meta.url),'utf8'));
  console.log('Coaching insight tables are ready. No client records or summaries were changed.');
}finally{await sql.end();}
