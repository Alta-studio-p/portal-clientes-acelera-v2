import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const migration = await readFile(new URL('../neon-add-coach-fees.sql', import.meta.url), 'utf8');
if (!process.argv.includes('--apply')) {
  console.log(migration);
  console.log('Solo crea coach_fees; no cambia clientes, llamadas ni pagos existentes.');
} else {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL no configurada.');
  await neon(url).query(migration);
  console.log('Tabla de honorarios lista.');
}
