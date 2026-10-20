import { readFile } from 'node:fs/promises';
import { createSqlClient } from '../lib/postgres.mjs';

const migration = await readFile(new URL('../neon-add-coach-fees.sql', import.meta.url), 'utf8');
if (!process.argv.includes('--apply')) {
  console.log(migration);
  console.log('Solo crea coach_fees; no cambia clientes, llamadas ni pagos existentes.');
} else {
  const sql = createSqlClient();
  try { await sql.query(migration); } finally { await sql.end(); }
  console.log('Tabla de honorarios lista.');
}
