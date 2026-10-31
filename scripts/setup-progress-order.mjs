import { readFile } from 'node:fs/promises';
import { createSqlClient } from '../lib/postgres.mjs';

const migration = await readFile(new URL('../supabase-progress-order.sql', import.meta.url), 'utf8');
if (!process.argv.includes('--apply')) {
  console.log(migration);
  console.log('Solo agrega una columna, un trigger y dos índices; no cambia datos existentes.');
} else {
  const sql = createSqlClient();
  try { await sql.query(migration); } finally { await sql.end(); }
  console.log('Orden de entrada y coach principal único listos.');
}
