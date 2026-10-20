import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

for (const name of ['enrich-client-names.mjs', 'enrich-salary-range.mjs']) {
  const script = new URL(name, import.meta.url).href;
  const fixture = `
    globalThis.fetch = async url => {
      const path = new URL(url).pathname;
      if (path === '/rest/v1/clients') return Response.json([
        { id: 'fixture-1', email: null, full_name: 'Cliente sin correo', desired_salary_range: null },
        { id: 'fixture-2', email: null, full_name: null, desired_salary_range: null }
      ]);
      if (path === '/rest/v1/calls') return Response.json([]);
      if (path === '/chat/completions') return Response.json({ choices: [{ message: { content: 'DESCONOCIDO' } }] });
      throw new Error('Unexpected fixture request');
    };
    await import(${JSON.stringify(script)});
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', fixture], {
    cwd: tmpdir(), encoding: 'utf8',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only',
      OPENROUTER_API_KEY: 'fixture-only', OPENROUTER_BASE_URL: 'https://fixture.invalid', ENRICH_DELAY_MS: '0',
    },
  });
  assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  assert.match(result.stdout, /failed=0/);
  console.log(`PASS: ${name} accepts clients with null email without network or writes`);
}
