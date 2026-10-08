import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const source = await readFile(new URL('../lib/call-sessions.ts', import.meta.url), 'utf8');
const { CLIENT_SESSIONS_QUERY } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const sql = neon(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const base = { client_id: id(100), started_at: '2026-10-02T19:00:00Z', title: 'Onboarding', source: 'fathom', summary: 'Resumen', share_url: 'https://example.com/recording', recording_url: null, created_at: '2026-10-03T00:00:00Z' };
const cases = [
  ['shared recording', {}, {}, 1],
  ['title case/spacing', {}, { title: '  ONBOARDING  ' }, 1],
  ['different client', {}, { client_id: id(101) }, 2],
  ['different time same day', {}, { started_at: '2026-10-02T20:00:00Z' }, 2],
  ['different title', {}, { title: 'Interview' }, 2],
  ['unknown client', { client_id: null }, { client_id: null }, 2],
  ['unknown date', { started_at: null }, { started_at: null }, 2],
  ['blank title', { title: '' }, { title: '' }, 2],
  ['manual entries', { source: 'manual' }, { source: 'manual' }, 2],
  ['same coach distinct recordings', {}, { coach_id: id(200) }, 2],
  ['unknown coach', { coach_id: null }, { coach_id: null }, 2],
  ['prefer summary', { summary: null }, {}, 1, id(2)],
  ['prefer recording link', { share_url: null }, {}, 1, id(2)],
];
for (const [name, first, second, count, preferred] of cases) {
  const rows = [{ ...base, id: id(1), coach_id: id(200), ...first }, { ...base, id: id(2), coach_id: id(201), ...second }];
  const query = `with fixture_calls as (
    select * from jsonb_to_recordset($1::jsonb) as r(id uuid, client_id uuid, coach_id uuid,
      started_at timestamptz, title text, source text, summary text,
      share_url text, recording_url text, created_at timestamptz)
  ) ${CLIENT_SESSIONS_QUERY.replaceAll('public.calls', 'fixture_calls')}`;
  const result = await sql.query(query, [JSON.stringify(rows)]);
  assert.equal(result.length, count, name);
  if (preferred) assert.equal(result[0].id, preferred, name);
  console.log(`PASS: ${name}`);
}
