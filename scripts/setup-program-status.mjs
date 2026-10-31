import { readFile } from 'node:fs/promises';
import { createSqlClient } from '../lib/postgres.mjs';

const migration = await readFile(new URL('../supabase-program-status.sql', import.meta.url), 'utf8');
if (!process.argv.includes('--apply')) {
  console.log(migration);
  console.log('Solo crea funciones y un disparador; no cambia ningún dato hasta que se ejecute la sincronización.');
} else {
  const sql = createSqlClient();
  try { await sql.query(migration); } finally { await sql.end(); }
  console.log('Estado por fecha de fin listo (función, disparador y sincronización).');
}
