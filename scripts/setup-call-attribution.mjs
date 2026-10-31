import { readFile } from 'node:fs/promises';
import { createSqlClient } from '../lib/postgres.mjs';

const migration = await readFile(new URL('../supabase-call-attribution.sql', import.meta.url), 'utf8');
if (!process.argv.includes('--apply')) {
  console.log(migration);
  console.log('Solo agrega columnas; no cambia ni borra llamadas, clientes, coaches ni pagos.');
} else {
  const sql = createSqlClient();
  try { await sql.query(migration); } finally { await sql.end(); }
  console.log('Columnas de atribución listas.');
}
