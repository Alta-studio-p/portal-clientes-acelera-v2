// Diagnóstico y backfill de llamadas: link público, cliente y coach.
//   node --env-file=.env.local scripts/backfill-call-attribution.mjs [--month=2026-10] [--skip-fathom] [--apply]
// Sin --apply solo lee y muestra lo que cambiaría. Nunca borra llamadas ni toca
// valores, estados ni fechas de pago; solo actualiza campos de atribución.
import fs from 'node:fs';
import { createSqlClient } from '../lib/postgres.mjs';
import { matchClient, clientInvitees } from '../lib/client-matching.mjs';
import { resolveCallCoach, sessionKey } from '../lib/coach-attribution.mjs';
import { fathomSourcesFromEnv, listMeetingsLight } from '../lib/fathom-api.mjs';
import { fetchCallSpeakers, isInternalCall, summarizeSpeakers } from '../lib/call-speakers.mjs';

const APPLY = process.argv.includes('--apply');
const SKIP_FATHOM = process.argv.includes('--skip-fathom');
// Solo atribución de coach: no toca los vínculos de clientes.
const ONLY_COACH = process.argv.includes('--only-coach');
const MONTH = process.argv.find(a => a.startsWith('--month='))?.split('=')[1] ?? '2026-10';
if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(MONTH)) throw new Error('--month debe ser AAAA-MM.');

const REASON_TO_METHOD = { invitee_email: 'email', invitee_name: 'name', full_name_in_title: 'name', manual_assignment: 'manual' };
const sql = createSqlClient();
const write = async (text, values) => { if (APPLY) await sql.query(text, values); };
const label = row => `${row.local_date} · ${row.title ?? '(sin título)'}`;

try {
  console.log(`\n=== ${APPLY ? 'APLICANDO' : 'DRY-RUN'} · mes de coach/diagnóstico: ${MONTH} ===`);
  const calls = await sql`
    select id::text, fathom_call_id, client_id::text, coach_id::text, title, share_url, raw_metadata,
      client_match_method, coach_resolution, (started_at at time zone 'America/Bogota')::date::text as local_date
    from public.calls order by started_at nulls last`;
  const clients = await sql`select id::text, email, full_name, alternate_emails from public.clients`;
  const coaches = await sql`select id::text, email, full_name, alternate_emails, bills_by_call from public.coaches`;
  const allParticipants = await sql`select call_id::text, email, name, role_hint from public.call_participants`;
  const participants = allParticipants.filter(p => p.role_hint === 'client');
  const fees = await sql`select call_id::text, paid_on::text from public.coach_fees where call_id is not null`;
  const assignments = await sql`select client_id::text, coach_id::text, is_primary from public.coach_client_assignments`;
  const coachName = id => coaches.find(c => c.id === id)?.full_name ?? coaches.find(c => c.id === id)?.email ?? '—';
  const clientName = id => clients.find(c => c.id === id)?.full_name ?? '—';
  const participantsByCall = Map.groupBy(participants, p => p.call_id);
  const feeByCall = new Map(fees.map(f => [f.call_id, f]));
  const assignedCoach = clientId => {
    const rows = assignments.filter(a => a.client_id === clientId);
    return (rows.find(a => a.is_primary) ?? (rows.length === 1 ? rows[0] : null))?.coach_id ?? null;
  };
  const invitees = call => {
    const stored = call.raw_metadata?.external_invitees;
    return Array.isArray(stored) && stored.length ? stored : (participantsByCall.get(call.id) ?? []);
  };

  // 1. Link público (share_url) y quién grabó (recorded_by), desde Fathom.
  const fathom = new Map();
  const sources = SKIP_FATHOM ? [] : fathomSourcesFromEnv();
  if (!sources.length) console.log('\n[1] Sin FATHOM_SOURCE_*_API_KEY (o --skip-fathom): no se consulta Fathom; share_url y recorded_by quedan como están.');
  for (const source of sources) {
    const meetings = await listMeetingsLight(source);
    console.log(`Fathom ${source.key}: ${meetings.length} reuniones`);
    for (const m of meetings) {
      const id = String(m.recording_id);
      const previous = fathom.get(id);
      fathom.set(id, { share_url: m.share_url || previous?.share_url || null, recorded_by: m.recorded_by || previous?.recorded_by || null });
    }
  }
  let sharedFilled = 0, recorderFilled = 0;
  for (const call of calls) {
    const meeting = fathom.get(call.fathom_call_id);
    if (!meeting) continue;
    const needShare = !call.share_url?.trim() && meeting.share_url;
    const needRecorder = !call.raw_metadata?.recorded_by && meeting.recorded_by;
    if (!needShare && !needRecorder) continue;
    await write(
      `update public.calls set share_url = coalesce(nullif(trim(share_url), ''), $2), raw_metadata = coalesce(raw_metadata, '{}'::jsonb) || $3::jsonb where id = $1::uuid`,
      [call.id, meeting.share_url ?? null, JSON.stringify(needRecorder ? { recorded_by: meeting.recorded_by } : {})],
    );
    if (needShare) { call.share_url = meeting.share_url; sharedFilled += 1; }
    if (needRecorder) { call.raw_metadata = { ...call.raw_metadata, recorded_by: meeting.recorded_by }; recorderFilled += 1; }
  }
  const noShare = calls.filter(c => !c.share_url?.trim());
  console.log(`\n[1] share_url completados: ${sharedFilled} · recorded_by completados: ${recorderFilled} · llamadas aún sin share_url: ${noShare.length}`);

  // 2. Cliente.
  let backfilledMethod = 0;
  for (const call of calls.filter(c => c.client_id && !c.client_match_method)) {
    const method = REASON_TO_METHOD[call.raw_metadata?.client_match_reason];
    if (!method) continue;
    await write(`update public.calls set client_match_method = $2 where id = $1::uuid and client_match_method is null`, [call.id, method]);
    call.client_match_method = method;
    backfilledMethod += 1;
  }
  console.log(`\n[2] Llamadas con cliente a las que se les registró el método original: ${backfilledMethod}`);

  const unlinked = calls.filter(c => !c.client_id);
  const linkedBy = { email: [], alt_email: [], name: [] };
  const stillUnlinked = [];
  for (const call of ONLY_COACH ? [] : unlinked) {
    const result = matchClient({ invitees: invitees(call), title: call.title }, clients);
    if (!result.client) { stillUnlinked.push({ call, reason: result.reason }); continue; }
    linkedBy[result.method].push({ call, result });
    const audit = JSON.stringify({ client_match_reason: result.method === 'name' ? 'name_backfill' : result.method });
    await write(`update public.calls set client_id = $2::uuid, client_match_method = $3, raw_metadata = coalesce(raw_metadata, '{}'::jsonb) || $4::jsonb where id = $1::uuid and client_id is null`, [call.id, result.client.id, result.method, audit]);
    await write(`update public.coach_fees set client_id = $2::uuid where call_id = $1::uuid and client_id is null`, [call.id, result.client.id]);
    if (call.coach_id) await write(`insert into public.coach_client_assignments (coach_id, client_id, is_primary) values ($1::uuid, $2::uuid, false) on conflict (coach_id, client_id) do nothing`, [call.coach_id, result.client.id]);
    if (result.learnEmail) {
      await write(`update public.clients set alternate_emails = array_append(alternate_emails, $2) where id = $1::uuid and not ($2 = any(alternate_emails))`, [result.client.id, result.learnEmail]);
      result.client.alternate_emails = [...(result.client.alternate_emails ?? []), result.learnEmail];
    }
    call.client_id = result.client.id;
  }
  console.log(`[2] Sin cliente: ${unlinked.length} → vinculadas por email: ${linkedBy.email.length}, email alterno: ${linkedBy.alt_email.length}, nombre: ${linkedBy.name.length}; siguen sin cliente: ${stillUnlinked.length}`);
  for (const { call, result } of linkedBy.name) console.log(`   nombre → ${label(call)} → ${result.client.full_name}${result.learnEmail ? ` (guardaría email alterno ${result.learnEmail})` : ''}`);

  console.log(`\n[2] Diagnóstico de llamadas SIN cliente en ${MONTH}:`);
  const monthUnlinked = stillUnlinked.filter(({ call }) => call.local_date?.startsWith(MONTH));
  for (const { call, reason } of monthUnlinked) {
    const guests = clientInvitees(invitees(call)).map(i => `${i.name || '(sin nombre)'} <${i.email}>`).join(', ') || '(sin invitados externos)';
    console.log(`   ${label(call)}\n      invitados: ${guests}\n      motivo: ${reason}`);
  }
  if (!monthUnlinked.length) console.log('   (ninguna)');

  // 3. Coach: quien grabó la llamada; la coach principal solo cede si un coach que cobra habla en la transcripción.
  //    Las llamadas internas (sin cliente y solo coaches hablando) no se pagan nunca: quedan en la coach principal.
  const inMonth = calls.filter(c => c.local_date?.startsWith(MONTH) && c.coach_resolution !== 'manual');
  const billingEmails = new Map(coaches.filter(c => c.bills_by_call).flatMap(c => [c.email, ...(c.alternate_emails ?? [])].map(e => [String(e).toLowerCase(), c.id])));
  const ownRecordings = new Set(calls.filter(c => billingEmails.has(String(c.raw_metadata?.recorded_by?.email ?? '').toLowerCase())).map(c => sessionKey(c.local_date, c.title)));
  const principal = coaches.find(c => c.bills_by_call === false);
  const plan = [], flagged = [], unknownRecorders = new Map();
  for (const call of inMonth) {
    const recordedByEmail = call.raw_metadata?.recorded_by?.email ?? null;
    const recorderCoach = coaches.find(c => [c.email, ...(c.alternate_emails ?? [])].map(e => String(e).toLowerCase()).includes(String(recordedByEmail ?? '').toLowerCase()));
    let info = call.raw_metadata?.speaker_summary, metaUpdate = null;
    if (!info && call.share_url && (!call.client_id || (recorderCoach && !recorderCoach.bills_by_call))) {
      const speakers = await fetchCallSpeakers(call.share_url);
      if (speakers) { info = summarizeSpeakers(speakers); metaUpdate = { speaker_summary: info }; }
    }
    let outcome, internal = false;
    if (!call.client_id && principal && isInternalCall(info)) { outcome = { coachId: principal.id, resolution: 'recorded_by', needsConfirmation: false }; internal = true; }
    else outcome = resolveCallCoach({ recordedByEmail, coaches, speakerEmails: info?.coachEmails ?? [],
      hasOwnRecording: ownRecordings.has(sessionKey(call.local_date, call.title)) && !billingEmails.has(String(recordedByEmail ?? '').toLowerCase()), keepCoachId: call.coach_id, assignedCoachId: call.client_id ? assignedCoach(call.client_id) : null });
    if (outcome.resolution === 'fallback' && recordedByEmail) unknownRecorders.set(recordedByEmail, (unknownRecorders.get(recordedByEmail) ?? 0) + 1);
    if (outcome.needsConfirmation) flagged.push(call);
    plan.push({ call, outcome, internal, metaUpdate: internal ? { ...metaUpdate, internal_call: true } : metaUpdate });
  }
  const changed = plan.filter(x => (x.outcome.coachId && x.outcome.coachId !== x.call.coach_id) || x.outcome.resolution !== x.call.coach_resolution);
  const changes = plan.filter(x => x.outcome.coachId && x.outcome.coachId !== x.call.coach_id).map(({ call, outcome, internal }) => ({
    fecha: call.local_date, llamada: call.title, cliente: call.client_id ? clientName(call.client_id) : 'Sin cliente', de: coachName(call.coach_id), a: coachName(outcome.coachId),
    motivo: internal ? 'interna (sin cliente): no se paga' : outcome.resolution, 'honorario ya pagado': feeByCall.get(call.id)?.paid_on ? `sí (${feeByCall.get(call.id).paid_on})` : 'no' }));
  if (APPLY && changed.length) {
    // Respaldo antes de escribir: estado anterior de cada llamada que cambia.
    const dir = new URL('../backups/', import.meta.url); fs.mkdirSync(dir, { recursive: true });
    const file = new URL(`llamadas-antes-correccion-${new Date().toISOString().slice(0, 10)}-${Date.now()}.csv`, dir);
    const cols = ['id', 'fathom_call_id', 'local_date', 'title', 'client_id', 'coach_id_anterior', 'coach_resolution_anterior', 'coach_id_nuevo', 'coach_resolution_nuevo'];
    const q = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
    fs.writeFileSync(file, '\uFEFF' + [cols.join(','), ...changed.map(({ call, outcome }) => [call.id, call.fathom_call_id, call.local_date, call.title, call.client_id, call.coach_id, call.coach_resolution, outcome.coachId, outcome.resolution].map(q).join(','))].join('\n'));
    console.log(`Respaldo: ${changed.length} filas → backups/${file.pathname.split('/').pop()}`);
  }
  for (const { call, outcome, metaUpdate } of plan) {
    await write(`update public.calls set coach_id = $2::uuid, coach_resolution = $3, coach_needs_confirmation = $4, raw_metadata = coalesce(raw_metadata, '{}'::jsonb) || $5::jsonb where id = $1::uuid`, [call.id, outcome.coachId, outcome.resolution, outcome.needsConfirmation, JSON.stringify(metaUpdate ?? {})]);
    if (outcome.coachId && outcome.coachId !== call.coach_id) await write(`update public.coach_fees set coach_id = $2::uuid, updated_at = now() where call_id = $1::uuid`, [call.id, outcome.coachId]);
  }
  console.log(`\n[3] Llamadas de ${MONTH} revisadas: ${inMonth.length} · cambian de coach: ${changes.length} · "Coach por confirmar": ${flagged.length}`);
  if (changes.length) console.table(changes);
  if (unknownRecorders.size) {
    console.log('   Emails de quien grabó que no coinciden con ningún coach (agrega el email en coaches.alternate_emails si son de un coach):');
    for (const [email, n] of unknownRecorders) console.log(`      ${email} · ${n} llamadas`);
  }
  console.log(APPLY ? '\nListo: cambios aplicados.' : '\nDry-run: no se escribió nada. Repite con --apply para aplicar.');
} finally {
  await sql.end();
}
