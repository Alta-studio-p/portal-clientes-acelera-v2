import { pathToFileURL } from 'node:url';

export async function checkDatabaseHealth({ secret = process.env.CRON_SECRET, fetchImpl = fetch } = {}) {
  if (!secret) throw new Error('CRON_SECRET is required for the database health check.');
  const response = await fetchImpl('https://portal-clientes-acelera-v2.vercel.app/api/internal/database-health', {
    headers: { Authorization: `Bearer ${secret}` },
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Database health HTTP ${response.status}.`);
  const result = await response.json();
  if (result.ok !== true || result.provider !== 'supabase' ||
      !['clients', 'calls', 'sessions'].every(key => Number.isInteger(result[key]) && result[key] >= 0)) {
    throw new Error('Database health did not confirm Supabase.');
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkDatabaseHealth().then(result => console.log(JSON.stringify(result))).catch(() => {
    console.error('Supabase production health check failed. Check routing, CRON_SECRET and the database connection.');
    process.exitCode = 1;
  });
}
