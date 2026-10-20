/* eslint-disable @typescript-eslint/no-require-imports -- Execute server modules with isolated auth and data fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const coachId = '00000000-0000-4000-8000-000000000001';
const clientId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
let role = 'admin';
let queries = 0;
const coach = { id: coachId, full_name: 'Coach A', email: 'coach@example.invalid' };
const calls = [{ id: 'call-a', coach_id: coachId, client_id: null }];
function load(relative, mocks) {
  const file = path.join(root, relative);
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(root);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, file);
  return mod.exports;
}
const common = {
  'server-only': {},
  'next/navigation': { notFound() { throw Error('not found'); } },
  '@/lib/auth': { requireRole: async roles => {
    if (!roles.includes(role)) throw Error('denied');
    return { profile: { role } };
  } },
  '@/lib/db': { getSql: () => async (strings, ...values) => {
    queries++;
    const query = strings.join('?');
    assert.match(query, /^select /);
    assert.deepEqual(values, [coachId]);
    if (query.includes('from public.calls')) {
      assert.match(query, /where c.coach_id=\?::uuid and c.client_id is null/);
      return calls;
    }
    return [coach];
  } },
};
const data = load('lib/data/coach-preview.ts', common);
const stub = () => null;
const page = load('app/preview/coaches/[id]/[[...view]]/page.tsx', {
  ...common,
  '@/lib/data/coach-preview': data,
  '@/lib/data/coach': { getClientsForCoach: async id => {
    assert.equal(id, coachId); return [{ id: clientId, full_name: 'Client A', email: null }];
  } },
  '@/lib/data/client-detail': { getClientDetail: async id => ({ id }) },
  '@/lib/data/coach-fees': { getCoachFees: async id => { assert.equal(id, coachId); return []; } },
  '@/lib/coach-fees': { validMonth: value => value || '2026-10' },
  '@/components/coach-clients-view': { CoachClientsView: stub },
  '@/components/coach-fees-dashboard': { CoachFeesDashboard: stub },
  '@/components/client-detail-view': { ClientDetailView: stub },
  '@/components/call-assignment-queue': { CallAssignmentQueue: stub },
  '@/components/ui': { PageHeader: stub },
}).default;
const render = (view, query = {}) => page({ params: Promise.resolve({ id: coachId, view }), searchParams: Promise.resolve(query) });
(async () => {
  let checks = 0;
  for (const denied of ['coach', 'client', null]) {
    role = denied;
    const before = queries;
    await assert.rejects(data.requirePreviewCoach(coachId), /denied/);
    await assert.rejects(data.getPreviewUnassignedCalls(coachId), /denied/);
    for (const view of [[], ['fees'], ['unassigned'], ['clients', clientId]]) await assert.rejects(render(view), /denied/);
    assert.equal(queries, before); checks++;
  }
  role = 'admin';
  const before = queries;
  await assert.rejects(data.requirePreviewCoach('invalid'), /not found/);
  assert.equal(queries, before); checks++;
  assert.equal((await data.requirePreviewCoach(coachId)).id, coachId); checks++;
  assert.deepEqual(await data.getPreviewUnassignedCalls(coachId), calls); checks++;
  const home = await render([], { q: 'client' });
  assert.equal(home.props.basePath, `/preview/coaches/${coachId}`);
  assert.equal(home.props.q, 'client'); checks++;
  const fees = await render(['fees'], { month: '2026-09' });
  assert.equal(fees.props.readOnly, true);
  assert.equal(fees.props.coaches.length, 1);
  assert.equal(fees.props.coachId, coachId);
  assert.equal(fees.props.basePath, `/preview/coaches/${coachId}/fees`);
  assert.equal(fees.props.clientBasePath, `/preview/coaches/${coachId}/clients`);
  assert.equal(fees.props.month, '2026-09'); checks++;
  const queue = (await render(['unassigned'])).props.children[1];
  assert.equal(queue.props.readOnly, true);
  assert.deepEqual(queue.props.calls, calls); checks++;
  const detail = await render(['clients', clientId], { call: 'call-a' });
  assert.equal(detail.props.headerActions, undefined);
  assert.equal(detail.props.selectedCallId, 'call-a');
  assert.equal(detail.props.callHrefBase, `/preview/coaches/${coachId}/clients/${clientId}`); checks++;
  await assert.rejects(render(['clients', otherId]), /not found/); checks++;
  await assert.rejects(render(['clients', 'invalid']), /not found/); checks++;
  await assert.rejects(render(['fees', 'invalid']), /not found/); checks++;
  await assert.rejects(render(['unknown']), /not found/); checks++;
  console.log(`PASS: ${checks} coach preview checks; auth and data mocked; no database writes`);
})().catch(error => { console.error(error); process.exitCode = 1; });
