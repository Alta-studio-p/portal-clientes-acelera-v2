import {readFile} from 'node:fs/promises';
import {createSqlClient} from '../lib/postgres.mjs';
const migration=await readFile(new URL('../supabase-call-review.sql',import.meta.url),'utf8');
const sessionSource=await readFile(new URL('../lib/call-sessions.ts',import.meta.url),'utf8');
const {CLIENT_SESSIONS_VIEW_SQL}=await import(`data:text/javascript;base64,${Buffer.from(sessionSource).toString('base64')}`);
if(!process.argv.includes('--apply')) {
  console.log('Agrega revisión reversible de llamadas; no elimina grabaciones ni modifica pagos.');
} else {
  const sql=createSqlClient();
  try {await sql.transaction(async tx=>{await tx.query(migration);await tx.query(CLIENT_SESSIONS_VIEW_SQL);});}
  finally {await sql.end();}
  console.log('Revisión de llamadas habilitada. No se descartó ninguna llamada.');
}
