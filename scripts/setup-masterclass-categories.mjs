import { readFile } from 'node:fs/promises';
import { createSqlClient } from '../lib/postgres.mjs';

const sql = createSqlClient();
try {
  const [before] = await sql`
    select count(*)::int as total,
      count(*) filter (where category not in ('ai'))::int as to_ai,
      count(*) filter (where status = 'recording')::int as recordings
    from public.masterclasses`;
  console.log(`Masterclases: ${before.total}. Pasarán a "Inteligencia artificial": ${before.to_ai}. Grabaciones publicadas: ${before.recordings}.`);
  if (!process.argv.includes('--apply')) {
    console.log('Dry-run. Corre con --apply para aplicar supabase-masterclass-categories.sql.');
  } else {
    await sql.transaction(async (tx) => {
      await tx.query(await readFile(new URL('../supabase-masterclass-categories.sql', import.meta.url), 'utf8'));
    });
    console.log('Categorías de masterclases listas (Inteligencia artificial, Executive Lab, Guías).');
  }
} finally {
  await sql.end();
}
