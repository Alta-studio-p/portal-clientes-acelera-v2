import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../app/register/actions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replace(/^import .* from '(?!node:)[^']+';\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
// Evaluate in an isolated function so Auth and SQL are always mocks, never production.
const body = compiled.replace(/^import .*;\n/gm, '').replace('export async function', 'async function');
const { createHmac } = await import('node:crypto');
process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL;

async function run(options = {}) {
  const calls = [];
  const email = 'client@example.test';
  const user = { id: 'user-id', email, ...(options.confirmed ? { email_confirmed_at: '2026-01-01' } : {}) };
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    calls.push(query);
    if (query.includes('client_registration_limits')) return [{ key: '', attempts: options.rateLimited ? 100 : 1 }];
    if (query.startsWith('select id::text')) return options.unknown ? [] : Array.from({ length: options.duplicate ? 2 : 1 }, () => ({ id: 'client-id', email, full_name: 'Client', profile_id: options.mismatch ? 'other' : null }));
    if (query.includes('with eligible')) return options.bindingFailed ? [] : [{ id: 'client-id' }];
    if (query.includes('select role, email')) return options.staff ? [{ role: 'admin', email }] : options.noProfile ? [] : [{ role: 'client', email }];
    if (query.includes("role <> 'client'")) return options.conflict ? [{ id: 'conflict' }] : [];
    if (query.includes('where profile_id')) return options.linkedElsewhere ? [{ id: 'other-client' }] : [];
    throw new Error(`Unhandled mock query: ${query} ${values.length}`);
  };
  const admin = { auth: { admin: {
    listUsers: async () => { calls.push('list'); return { data: { users: options.newUser ? [] : [user] }, error: null }; },
    generateLink: async () => { calls.push('create'); return { data: { user }, error: null }; },
  }, resetPasswordForEmail: async () => { calls.push('send'); return { error: null }; } } };
  const action = new Function('createHmac', 'getSql', 'createAdminClient', 'getActivationUrl', 'headers', `${body}; return requestClientRegistration;`)(
    createHmac, () => sql, async () => admin, async () => 'https://example.test/auth/activate', async () => new Headers(),
  );
  const form = new FormData();
  form.set('email', options.invalid ? 'invalid' : ' Client@Example.Test ');
  form.set('role', 'admin');
  form.set('clientId', 'attacker-selected');
  const result = await action({ error: null, message: null }, form);
  return { result, calls };
}

const happy = await run();
assert.equal(happy.calls.filter(c => c === 'send').length, 1);
assert.equal(happy.result.error, null);
for (const blocked of [
  { unknown: true }, { duplicate: true }, { conflict: true }, { mismatch: true },
  { staff: true }, { linkedElsewhere: true }, { rateLimited: true },
  { bindingFailed: true }, { noProfile: true, confirmed: true },
]) {
  const { result, calls } = await run(blocked);
  assert.ok(!calls.includes('send'), JSON.stringify(blocked));
  assert.equal(result.message, happy.result.message);
}
assert.ok((await run({ newUser: true })).calls.includes('create'));
assert.ok((await run({ newUser: true })).calls.includes('send'));
assert.ok((await run({ confirmed: true })).calls.includes('send'));
assert.ok((await run({ invalid: true })).result.error);
assert.ok(!source.includes("form.get('role')"));
assert.ok(!source.includes("form.get('clientId')"));
console.log('14 registration scenarios passed; no network requests or real emails.');
