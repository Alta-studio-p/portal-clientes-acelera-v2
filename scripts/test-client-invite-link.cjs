/* eslint-disable @typescript-eslint/no-require-imports -- Isolated server-action fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const id = '00000000-0000-4000-8000-000000000001';
const uid = '00000000-0000-4000-8000-000000000002';
const email = 'client@example.invalid';
const previous = { error: null, message: null, link: null };
let fixture;
let generated;
let sideEffects;
const file = path.resolve(__dirname, '../app/admin/clients/[id]/invite-actions.ts');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = Module._nodeModulePaths(path.resolve(__dirname, '..'));
const api = {
  listUsers: async () => ({ data: { users: fixture.user ? [fixture.user] : [] }, error: null }),
  generateLink: async params => {
    sideEffects++; generated = params;
    return { data: { user: { id: fixture.wrongUser ? 'wrong-id' : uid, email }, properties: { hashed_token: 'fixture-token-only' } }, error: fixture.generateError ? {} : null };
  },
  inviteUserByEmail: async () => { sideEffects++; return { data: { user: { id: uid, email } }, error: null }; },
};
const mocks = {
  'next/headers': { headers: async () => new Map([['origin', 'http://localhost:3005']]) },
  'next/cache': { revalidatePath() {} },
  '@/lib/auth': { requireRole: async roles => { if (!roles.includes(fixture.role)) throw Error('denied'); return { userId: id }; } },
  '@/lib/activation-url': { getActivationUrl: async manual => {
    const configured = process.env.APP_URL || (manual ? 'https://portal-clientes-acelera-v2.vercel.app' : 'http://localhost:3005');
    if (manual && !configured.startsWith('https://')) throw Error('missing_origin');
    return `${configured}/auth/activate`;
  } },
  '@/lib/client-invitation.mjs': { issueClientInvitation: async (_sql, options) => {
    if (fixture.issueFailure) throw Error('fixture');
    sideEffects++;
    const url = new URL('/auth/invitation', options.origin);
    url.hash = 'token=fixture-token-only';
    return { link: url.toString(), expiresAt: '2026-10-22T00:00:00Z' };
  } },
  '@/lib/db': { getSql: () => async strings => {
    const query = strings.join('?');
    if (query.includes('select id::text, profile_id::text')) return [fixture.client];
    if (query.includes('where lower(email)')) return fixture.conflicts ? [{ id }] : [];
    if (query.includes('select role, email')) return fixture.profile ? [fixture.profile] : [];
    if (query.includes('select id from public.clients where profile_id')) return fixture.otherLink ? [{ id }] : [];
    if (query.includes('with eligible')) { sideEffects++; return fixture.bindFailure ? [] : [{ id }]; }
    throw Error('Unexpected query');
  } },
  '@/lib/supabase/server': { createAdminClient: async () => ({ auth: {
    admin: api, resetPasswordForEmail: async () => { sideEffects++; return { error: null }; },
  } }) },
};
mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
function reset() {
  fixture = { role: 'admin', client: { id, email, profile_id: null, full_name: 'Client' } };
  generated = null; sideEffects = 0;
  delete process.env.APP_URL; delete process.env.NEXT_PUBLIC_SITE_URL; delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  process.env.NODE_ENV = 'development';
}
function form(delivery = 'link') {
  const f = new FormData(); f.set('clientId', id); f.set('email', email); f.set('delivery', delivery); return f;
}
const run = f => mod.exports.inviteClient(previous, f || form());
(async () => {
  let checks = 0;
  for (const role of ['client','coach',null]) {
    reset(); fixture.role = role; await assert.rejects(run(), /denied/); assert.equal(sideEffects, 0); checks++;
  }
  reset(); const invalid = form(); invalid.set('clientId', 'bad'); assert((await run(invalid)).error); assert.equal(sideEffects, 0); checks++;
  reset(); assert((await run(form('bad'))).error); assert.equal(sideEffects, 0); checks++;
  reset(); fixture.client.email = null; assert((await run()).error); assert.equal(sideEffects, 0); checks++;
  reset(); const stale = form(); stale.set('email', 'other@example.invalid'); assert((await run(stale)).error); assert.equal(sideEffects, 0); checks++;
  reset(); fixture.conflicts = true; assert((await run()).error); assert.equal(sideEffects, 0); checks++;
  reset(); fixture.client.profile_id = uid; assert((await run()).error); assert.equal(sideEffects, 0); checks++;
  reset(); let result = await run();
  assert.equal(result.error, null); assert.equal(generated.type, 'invite');
  assert.equal(sideEffects, 3); // Auth creation, SQL binding, managed invitation; no email.
  const url = new URL(result.link);
  assert.equal(url.origin, 'https://portal-clientes-acelera-v2.vercel.app');
  assert.equal(url.pathname, '/auth/invitation'); assert.equal(url.search, '');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), 'fixture-token-only'); checks++;
  reset(); fixture.user = { id: uid, email, email_confirmed_at: '2026-01-01' }; fixture.profile = { role: 'client', email };
  result = await run(); assert.equal(result.error, null); assert.equal(generated, null); assert.equal(sideEffects, 2); checks++;
  reset(); fixture.user = { id: uid, email }; result = await run(); assert.equal(result.error, null); assert.equal(generated, null); checks++;
  for (const profile of [{ role: 'admin', email }, { role: 'coach', email }, { role: 'client', email: 'other@example.invalid' }]) {
    reset(); fixture.user = { id: uid, email }; fixture.profile = profile;
    assert((await run()).error); assert.equal(sideEffects, 0); checks++;
  }
  reset(); fixture.user = { id: uid, email, email_confirmed_at: '2026-01-01' }; assert((await run()).error); assert.equal(sideEffects, 0); checks++;
  reset(); fixture.user = { id: uid, email }; fixture.otherLink = true; assert((await run()).error); assert.equal(sideEffects, 0); checks++;
  reset(); fixture.user = { id: uid, email }; fixture.issueFailure = true; result = await run(); assert(result.error); assert.equal(result.link, null); checks++;
  reset(); fixture.generateError = true; result = await run(); assert(result.error); assert.equal(result.link, null); checks++;
  reset(); fixture.bindFailure = true; result = await run(); assert(result.error); assert.equal(result.link, null); checks++;
  reset(); process.env.APP_URL = 'http://localhost:3002'; result = await run(); assert(result.error); assert.equal(sideEffects, 0); checks++;
  reset(); result = await run(form('email')); assert.equal(result.error, null); assert.equal(result.link, null); assert.equal(generated, null); checks++;
  console.log(`PASS: ${checks} invitation-link checks; mocked Supabase/Auth/SQL; no real accounts, emails or links generated`);
})().catch(error => { console.error(error); process.exitCode = 1; });
