import assert from 'node:assert/strict';
import { checkDatabaseHealth } from './check-database-health.mjs';

const healthy = { ok: true, provider: 'supabase', clients: 66, calls: 414, sessions: 413 };
const check = response => checkDatabaseHealth({ secret: 'fixture-only', fetchImpl: async (_url, options) => {
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, 'Bearer fixture-only');
  return response;
} });
assert.deepEqual(await check(Response.json(healthy)), healthy);
for (const status of [307, 401, 503]) {
  await assert.rejects(check(new Response('', { status })), new RegExp(`HTTP ${status}`));
}
await assert.rejects(check(new Response('<html>Login</html>')));
await assert.rejects(check(Response.json({ ...healthy, provider: 'neon' })), /did not confirm/);
await assert.rejects(check(Response.json({ ...healthy, calls: null })), /did not confirm/);
await assert.rejects(checkDatabaseHealth({ secret: '' }), /CRON_SECRET/);
console.log('PASS: valid health response; redirects, HTML, missing auth, errors and invalid provider rejected');
