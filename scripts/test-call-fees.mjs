import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import * as callHours from '../lib/call-hours.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(file, mocks) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected import: ${name}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}
const fees = load('lib/coach-fees.ts', {});
const coachId = '00000000-0000-4000-8000-000000000001';
const callId = '00000000-0000-4000-8000-000000000002';

test('two duration bands use exact seconds without rounding and have no long-call surcharge', () => {
  for (const minutes of [1 / 60, 15, 29, 30, 40, 46, 47]) {
    assert.equal(callHours.hoursForMinutes(minutes) * fees.CALL_HOURLY_RATE, 50_000);
  }
  for (const minutes of [47 + 1 / 60, 48, 70, 80, 105, 180]) {
    assert.equal(callHours.hoursForMinutes(minutes) * fees.CALL_HOURLY_RATE, 100_000);
  }
  for (const minutes of [null, undefined, 0, -1, NaN, Infinity, 'invalid']) {
    assert.equal(callHours.hoursForMinutes(minutes), null);
  }
});

test('November rates do not reprice prior months', () => {
  for (const [minutes, legacy] of [[35, 0.5], [40, 1], [47, 1], [80, 1], [100, 1.5], [120, 2]]) {
    assert.equal(callHours.hoursForMinutes(minutes, '2026-10-31'), legacy);
    assert.equal(callHours.hoursForMinutes(minutes, '2026-11-01'), minutes <= 47 ? 0.5 : 1);
    assert.equal(callHours.hoursForMinutes(minutes, '2026-12-01'), minutes <= 47 ? 0.5 : 1);
  }
});

test('visible minutes use recording duration, never payment units', () => {
  assert.equal(callHours.feeDurationMinutes({ call_id: callId, duration_minutes: 42, hours: 0.5 }), 42);
  assert.equal(callHours.feeDurationMinutes({ call_id: callId, duration_minutes: 125, hours: 1 }), 125);
  assert.equal(callHours.feeDurationMinutes({ call_id: callId, duration_minutes: null, hours: 1 }), null);
  assert.equal(callHours.feeDurationMinutes({ call_id: null, hours: 1.5 }), 90);
  assert.equal(callHours.feeDurationMinutes({ call_id: null, hours: null }), null);
  const dashboard = readFileSync(new URL('../components/coach-fees-dashboard.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /Minutos registrados/);
  assert.match(dashboard, /Duración \(min\)/);
  assert.doesNotMatch(dashboard, /Horas registradas|Número de horas/);
});

test('dashboard pricing preserves saved fees and leaves unknown duration unpriced', async () => {
  let role = 'admin';
  let queryCount = 0;
  const rows = [
    { call_id: callId, duration_minutes: 40, hours: null, amount: null },
    { call_id: callId, duration_minutes: 47, hours: null, amount: null },
    { call_id: callId, duration_minutes: 47 + 1 / 60, hours: null, amount: null },
    { call_id: callId, duration_minutes: 120, hours: null, amount: null },
    { call_id: callId, duration_minutes: null, hours: null, amount: null },
    { call_id: callId, duration_minutes: 40, hours: 2, amount: 175_000, paid_on: '2026-11-01' },
    { call_id: null, duration_minutes: null, hours: 1.5, amount: 80_000 },
  ];
  const data = load('lib/data/coach-fees.ts', {
    'server-only': {},
    '@/lib/auth': { requireRole: async roles => {
      if (!roles.includes(role)) throw Error('denied');
      return { userId: 'fixture', profile: { role } };
    } },
    '@/lib/data/client-detail': { getCoachByProfileId: async () => ({ id: coachId }) },
    '@/lib/db': { getSql: () => async strings => {
      queryCount++;
      assert.match(strings.join('?'), /duration_seconds \/ 60\.0/);
      assert.doesNotMatch(strings.join('?'), /round\(c.duration_seconds/);
      return rows;
    } },
    '@/lib/call-title': { displayCallTitle: () => 'Fixture' },
    '@/lib/recording-link': { publicRecordingUrl: () => null },
    '@/lib/call-hours.mjs': callHours,
    '@/lib/coach-fees': fees,
  });
  const result = await data.getCoachFees(coachId, '2026-11');
  assert.deepEqual(result.map(row => row.amount), [50_000, 50_000, 100_000, 100_000, null, 175_000, 80_000]);
  assert.equal(result[5].hours, 2);
  assert.equal(result[5].paid_on, '2026-11-01');
  rows[0].service_date = '2026-10-31';
  assert.equal((await data.getCoachFees(coachId, '2026-10'))[0].amount, 100_000);
  role = 'coach';
  await data.getCoachFees(coachId, '2026-11');
  await assert.rejects(data.getCoachFees(callId, '2026-11'), /No tienes acceso/);
  role = 'client';
  await assert.rejects(data.getCoachFees(coachId, '2026-11'), /denied/);
  assert.equal(queryCount, 3);
});

test('saving blank call fees calculates on the server from trusted duration', async () => {
  for (const [seconds, expectedHours, expectedAmount] of [[2400, 0.5, 50_000], [2820, 0.5, 50_000], [2821, 1, 100_000], [7200, 1, 100_000], [null, null, null]]) {
    let saved;
    const sql = async (strings, ...values) => {
      const query = strings.join('?');
      if (query.includes('insert into public.coach_fees')) { saved = values; return []; }
      if (query.includes('from public.calls')) return [{ id: callId, client_id: 'already-linked', duration_seconds: seconds }];
      if (query.includes('from public.coaches')) return [{ id: coachId }];
      throw Error('Unexpected query');
    };
    const actions = load('app/admin/fees/actions.ts', {
      'next/cache': { revalidatePath() {} },
      '@/lib/auth': { requireRole: async () => ({ userId: coachId }) },
      '@/lib/db': { getSql: () => sql },
      '@/lib/coach-fees': fees,
      '@/lib/client-matching.mjs': { emailToLearn() { throw Error('Unexpected association'); } },
      '@/lib/call-hours.mjs': callHours,
    });
    const form = new FormData();
    for (const [key, value] of Object.entries({ coachId, callId, topic: 'Fixture', serviceDate: '2026-11-12' })) form.set(key, value);
    assert.equal((await actions.saveFee({}, form)).success, true);
    assert.equal(saved[5], expectedHours);
    assert.equal(saved[6], expectedAmount);
    form.set('serviceDate', '2026-10-31');
    assert.equal((await actions.saveFee({}, form)).success, true);
    assert.equal(saved[5], callHours.hoursForMinutes(seconds === null ? null : seconds / 60, '2026-10-31'));
    form.set('serviceDate', '2026-11-12');
    form.set('hours', '1.5');
    form.set('amount', '75000');
    assert.equal((await actions.saveFee({}, form)).success, true);
    assert.equal(saved[5], 1.5);
    assert.equal(saved[6], 75_000);
  }
});
