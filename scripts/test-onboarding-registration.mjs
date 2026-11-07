import assert from 'node:assert/strict';
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
