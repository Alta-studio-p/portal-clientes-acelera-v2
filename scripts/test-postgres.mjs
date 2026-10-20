import assert from 'node:assert/strict';
import { createSqlClient } from '../lib/postgres.mjs';

assert.throws(() => createSqlClient('postgresql://example:password@example.neon.tech/db'));
const sql = createSqlClient();
try {
  const injection = "'; drop table public.calls; --";
  const [row] = await sql`select ${injection}::text as value, ${[1, 2]}::int[] as items,
    '2026-10-20'::date as day, '2026-10-20T15:30:00Z'::timestamptz as instant,
    '{"ok":true}'::jsonb as data`;
  assert.equal(row.value, injection);
  assert.deepEqual(row.items, [1, 2]);
  assert.equal(row.day, '2026-10-20');
  assert.equal(typeof row.instant, 'string');
  assert.equal(new Date(String(row.instant)).toISOString(), '2026-10-20T15:30:00.000Z');
  assert.deepEqual(row.data, { ok: true });
  console.log('PASS: TLS, parameter binding, arrays, dates and JSON');

  // Temporary objects only: no application records are inserted or changed.
  await sql.transaction(async tx => {
    await tx.query('create temporary table connection_test (value integer) on commit drop');
    await tx`insert into connection_test values (${42})`;
    const [result] = await tx`select value from connection_test`;
    assert.equal(result.value, 42);
  });
  await assert.rejects(sql.transaction(async tx => {
    await tx.query('create temporary table rollback_test (value integer) on commit drop');
    await tx`insert into rollback_test values (${1})`;
    throw new Error('intentional rollback');
  }), /intentional rollback/);
  const [tables] = await sql`select to_regclass('pg_temp.connection_test')::text as committed,
    to_regclass('pg_temp.rollback_test')::text as rolled_back`;
  assert.equal(tables.committed, null);
  assert.equal(tables.rolled_back, null);
  assert.equal((await sql`select 1 as healthy`)[0].healthy, 1);
  console.log('PASS: transaction connection affinity, commit, rollback and recovery');

  const [counts] = await sql`select
    (select count(*)::int from public.clients) as clients,
    (select count(*)::int from public.calls) as calls,
    (select count(*)::int from public.client_sessions) as sessions,
    (select count(*)::int from public.coaches) as coaches,
    (select count(*)::int from public.coach_fees) as fees,
    (select count(*)::int from public.profiles p left join auth.users u on u.id=p.id where u.id is null) as orphan_profiles,
    (select count(*)::int from public.clients c left join public.profiles p on p.id=c.profile_id
      where c.profile_id is not null and (p.id is null or p.role <> 'client')) as invalid_client_access`;
  assert.equal(counts.orphan_profiles, 0);
  assert.equal(counts.invalid_client_access, 0);
  console.log(JSON.stringify({ provider: 'supabase', ...counts }));
} finally {
  await sql.end();
}
