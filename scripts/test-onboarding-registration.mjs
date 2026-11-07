import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

async function mockAction(path, name, deps) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const body = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/^import .*;\n/gm, '').replace('export async function', 'async function');
  return new Function(...Object.keys(deps), `${body}; return ${name};`)(...Object.values(deps));
}

const email = 'client@example.test';
const redirectTo = 'https://portal.example.test/auth/activate';

test('only eligible addresses get an email, without leaking eligibility', async () => {
  for (const scenario of ['new', 'confirmed', 'unknown', 'rate-limited', 'internal']) {
    const calls = [];
    const action = await mockAction('../app/register/onboarding-actions.ts', 'requestOnboardingAccess', {
      createHmac,
      process: { env: { SUPABASE_SECRET_KEY: 'fixture' } },
      getSql: () => async (query) => query.join('?').includes('client_registration_limits')
        ? [{ attempts: scenario === 'rate-limited' ? 16 : 1 }]
        : scenario === 'unknown' ? [] : [{ full_name: 'Test Client', confirmed: scenario === 'confirmed' }],
      getActivationUrl: async () => redirectTo,
      createAdminClient: async () => ({ auth: {
        admin: { inviteUserByEmail: async (...args) => { calls.push(['invite', ...args]); return {}; } },
        resetPasswordForEmail: async (...args) => { calls.push(['recover', ...args]); return {}; },
      } }),
    });
    const form = new FormData();
    form.set('email', scenario === 'internal' ? 'coach@joinaceleratalent.com' : ' Client@Example.Test ');
    const result = await action({}, form);
    assert.equal(result.error, null);
    assert.match(result.message, /^Si el correo coincide/);
    if (scenario === 'new' || scenario === 'confirmed') {
      assert.equal(calls[0][0], scenario === 'new' ? 'invite' : 'recover');
      assert.equal(calls[0][1], email);
      assert.equal(calls[0][2].redirectTo, redirectTo);
    } else assert.equal(calls.length, 0);
  }
});

test('activation never binds without a verified session, and does not alter existing roles', async () => {
  for (const scenario of ['unverified', 'refused', 'new', 'existing', 'coach']) {
    const calls = [];
    const role = scenario === 'coach' ? 'coach' : 'client';
    const action = await mockAction('../app/auth/activate/actions.ts', 'setNewPassword', {
      getSessionProfile: async () => scenario === 'unverified' ? null : { userId: 'uid', email, profile: { role } },
      getClientByProfileId: async () => scenario === 'existing' ? { id: 'client-id' } : null,
      claimOnboardingClient: async (...args) => { calls.push(['claim', ...args]); return scenario === 'new'; },
      createClient: async () => ({ auth: { updateUser: async () => { calls.push(['password']); return {}; } } }),
      roleHome: (r) => r === 'coach' ? '/coach' : '/portal',
      redirect: (destination) => { calls.push(['redirect', destination]); throw new Error('redirect'); },
    });
    const form = new FormData();
    form.set('password', 'test-password-123');
    form.set('confirmPassword', 'test-password-123');
    if (scenario === 'unverified' || scenario === 'refused') {
      assert.ok((await action({}, form)).error);
      assert.ok(!calls.some(([kind]) => kind === 'password'));
    } else {
      await assert.rejects(action({}, form), /redirect/);
      assert.deepEqual(calls.at(-1), ['redirect', scenario === 'coach' ? '/coach' : '/portal']);
    }
    assert.equal(calls.some(([kind]) => kind === 'claim'), scenario === 'new' || scenario === 'refused');
  }
});
