// Sincroniza con la hoja "Ingresos 2026" (descargada como CSV): orden de entrada, fechas de inicio/fin y coach principal.
//   node --env-file=.env.local scripts/sync-sheet-order.mjs [--csv=ingresos-2026.csv] [--assign="Beto=coach@joinaceleratalent.com"] [--apply]
// Sin --apply solo lee y muestra el reporte. Con --apply guarda antes un respaldo en backups/.
// De la hoja solo se usan nombre, "Día Empezó", "Día Termina" y los meses con pago (para estimar fechas faltantes).
// Cédula, teléfono, email y valores de pago NO se leen ni se guardan. Cambios que NO hace: sesiones, progreso, estados ni etiquetas.
import fs from 'node:fs';
import { createSqlClient } from '../lib/postgres.mjs';
import { normalizeIdentity as norm } from '../lib/client-matching.mjs';

const APPLY = process.argv.includes('--apply');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const CSV = new URL(`../${arg('csv') ?? 'ingresos-2026.csv'}`, import.meta.url);
const YEAR = 2026; // la hoja es "Ingresos 2026": las fechas sin año ("26 Feb") son de este año
const ASSIGN = process.argv.filter(a => a.startsWith('--assign=')).map(a => a.slice(9).split('='));

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const MES = { ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12 };
const pad = n => String(n).padStart(2, '0');
/** "26 Feb", "2 Marzo", "Agosto 15", "15/08/2026", "2026-08-15" → { iso } · solo mes → { iso: día 1, approx } · otro texto → { raw } */
function parseDate(value) {
  const s = String(value ?? '').trim(); if (!s) return null;
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); if (m) return { iso: `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}` };
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return { iso: m[0] };
  const t = norm(s);
  m = t.match(/^(\d{1,2}) (?:de )?([a-z]+)(?: (?:de )?(\d{4}))?$/); if (m && MES[m[2]]) return { iso: `${m[3] ?? YEAR}-${pad(MES[m[2]])}-${pad(m[1])}` };
  m = t.match(/^([a-z]+) (\d{1,2})$/); if (m && MES[m[1]]) return { iso: `${YEAR}-${pad(MES[m[1]])}-${pad(m[2])}` };
  m = t.match(/^([a-z]+)$/); if (m && MES[m[1]]) return { iso: `${YEAR}-${pad(MES[m[1]])}-01`, approx: true };
  return { raw: s.slice(0, 24) };
}
// Mismo criterio que la vista Progreso: mismo día 3 meses después, o el último día de ese mes si no existe.
const addThreeMonths = iso => { const [y, mo, d] = iso.split('-').map(Number); const last = new Date(Date.UTC(y, mo + 3, 0)).getUTCDate(); return new Date(Date.UTC(y, mo - 1 + 3, Math.min(d, last))).toISOString().slice(0, 10); };
const hasMoney = v => Number(String(v ?? '').replace(/[^\d]/g, '')) > 0;

// ---------- hoja
const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const head = rows[0].map(h => h.trim()); const col = n => head.indexOf(n);
const iName = col('CLIENTE'), iStart = col('Día Empezó'), iEnd = col('Día Termina');
const monthCols = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map(col);
if ([iName, iStart, iEnd].includes(-1)) throw new Error('El CSV debe traer las columnas CLIENTE, "Día Empezó" y "Día Termina".');
const sheet = [];
for (const r of rows.slice(1)) {
  const name = (r[iName] ?? '').trim(); if (!name || /^(total|suma)/i.test(name)) continue;
  const m = monthCols.findIndex(i => hasMoney(r[i]));
  sheet.push({ order: sheet.length + 1, name, start: parseDate(r[iStart]), end: parseDate(r[iEnd]), rawStart: (r[iStart] ?? '').trim(), firstPay: m >= 0 ? `${YEAR}-${pad(m + 1)}-01` : null });
}

const sql = createSqlClient();
try {
  const clients = await sql`select id::text, full_name, start_date::text, end_date::text, entry_order from public.clients`;
  const firstCalls = await sql`select client_id::text, min((started_at at time zone 'America/Bogota')::date)::text d from public.calls where client_id is not null and started_at is not null group by 1`;
  const firstCall = new Map(firstCalls.map(r => [r.client_id, r.d]));
  const coaches = await sql`select id::text, email, coalesce(full_name, email) name, is_support_coach from public.coaches`;
  const assignments = await sql`select client_id::text, coach_id::text, is_primary from public.coach_client_assignments`;
  const callsBy = await sql`select client_id::text, coach_id::text, count(*)::int n, min(started_at)::text first_at from public.calls where client_id is not null and coach_id is not null group by 1, 2`;
  const coachName = id => coaches.find(c => c.id === id)?.name ?? id;
  const isSupport = id => !!coaches.find(c => c.id === id)?.is_support_coach;

  // ---------- emparejar: nombre exacto → nombre + primer apellido → uno contenido en el otro; nunca se adivina
  const tok = s => norm(s).split(' ').filter(Boolean);
  const tier = (a, b) => {
    const A = norm(a), B = norm(b); if (A === B) return 3;
    const ta = tok(a), tb = tok(b);
    if (ta.length >= 2 && tb.length >= 2 && ta[0] === tb[0] && ta[1] === tb[1]) return 2;
    if (ta.length >= 2 && tb.length >= 2 && (` ${B} `.includes(` ${A} `) || ` ${A} `.includes(` ${B} `))) return 1;
    return 0;
  };
  const matches = [], notFound = [], doubtful = [], taken = new Map();
  for (const s of sheet) {
    const cands = clients.map(c => ({ c, t: tier(s.name, c.full_name) })).filter(x => x.t > 0);
    const best = Math.max(0, ...cands.map(x => x.t)); const top = cands.filter(x => x.t === best);
    if (!cands.length) { notFound.push(s); continue; }
    if (top.length > 1) { doubtful.push({ s, why: `varios candidatos: ${top.map(x => x.c.full_name).join(' / ')}` }); continue; }
    if (taken.has(top[0].c.id)) { doubtful.push({ s, why: `ya emparejado con la fila ${taken.get(top[0].c.id)}` }); continue; }
    taken.set(top[0].c.id, s.order); matches.push({ s, c: top[0].c, t: best });
  }

  // ---------- fechas: las de la hoja; si faltan, se infieren por el orden cronológico de entrada
  const known = sheet.map(s => (s.start?.iso && !s.start.approx ? s.start.iso : null));
  const bounds = i => ({ lo: [...known.slice(0, i)].reverse().find(Boolean) ?? null, hi: known.slice(i + 1).find(Boolean) ?? null });
  const clamp = (v, lo, hi) => (lo && v < lo ? lo : hi && v > hi ? hi : v);
  const today = new Date().toISOString().slice(0, 10);
  let previous = null; // inicio ya resuelto de la fila anterior: quien está más abajo en la hoja entró después
  for (const m of matches) {
    const { s, c } = m; const i = s.order - 1; const { hi } = bounds(i); const lo = previous;
    if (known[i]) { m.start = known[i]; m.startNote = null; }
    else {
      const fc = firstCall.get(c.id); const ok = v => v && (!lo || v >= lo) && (!hi || v <= hi);
      if (ok(fc)) { m.start = fc; m.startNote = `aproximada: primera llamada en Fathom (la hoja dice "${s.rawStart || 'vacío'}")`; }
      else { m.start = clamp(s.firstPay ?? today, lo, hi); m.startNote = `aproximada: ${s.firstPay ? 'primer mes con pago' : 'hoy'} entre sus vecinos de la hoja (la hoja dice "${s.rawStart || 'vacío'}")`; }
    }
    previous = m.start;
    const e = s.end?.iso && !s.end.approx ? s.end.iso : null;
    m.end = e ?? addThreeMonths(m.start); m.endNote = e ? null : `inicio + 3 meses${s.end?.raw ? ` (la hoja dice "${s.end.raw}")` : ''}`;
  }

  // ---------- coach principal: lo que ya tiene; si no, el coach de trabajo con más llamadas (empate: el de la primera llamada).
  // La coach de apoyo (is_support_coach) no puede ser principal de un cliente con coach de trabajo: la base lo descarta.
  // --assign fuerza uno.
  const forced = new Map(ASSIGN.filter(x => x.length === 2).map(([n, email]) => [norm(n), coaches.find(c => c.email === email)]));
  const primaryOf = id => assignments.find(a => a.client_id === id && a.is_primary)?.coach_id ?? null;
  const proposals = [], ties = [], noCoach = [];
  for (const c of clients) {
    if (primaryOf(c.id)) continue;
    const force = forced.get(norm(c.full_name));
    if (force) { proposals.push({ c, coachId: force.id, why: 'indicado por ti' }); continue; }
    const calls = callsBy.filter(x => x.client_id === c.id && !isSupport(x.coach_id)).sort((a, b) => b.n - a.n || String(a.first_at).localeCompare(String(b.first_at)));
    if (!calls.length) { noCoach.push(c); continue; }
    const tied = calls.filter(x => x.n === calls[0].n);
    // Empate: se propone el de la primera llamada y se lista para confirmar.
    if (tied.length > 1) ties.push({ c, calls });
    proposals.push({ c, coachId: calls[0].coach_id, why: calls.map(x => `${coachName(x.coach_id)}×${x.n}`).join(', ') + (tied.length > 1 ? ' · EMPATE: primera llamada' : '') });
  }

  // ---------- reporte
  const changed = matches.filter(m => m.c.entry_order !== m.s.order || m.c.start_date !== m.start || m.c.end_date !== m.end);
  console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} · hoja: ${sheet.length} filas · portal: ${clients.length} clientes`);
  console.log(`\n1. Emparejados con la hoja: ${matches.length} (exacto ${matches.filter(m => m.t === 3).length}, nombre+apellido ${matches.filter(m => m.t === 2).length}, contenido ${matches.filter(m => m.t === 1).length}) · con algún cambio: ${changed.length}`);
  matches.filter(m => m.t < 3).forEach(m => console.log(`   aproximado: "${m.s.name}" → ${m.c.full_name}`));
  console.log(`\n2. En la hoja y no en el portal: ${notFound.length}`); notFound.forEach(s => console.log(`   fila ${s.order}: ${s.name}`));
  const notInSheet = clients.filter(c => !taken.has(c.id));
  console.log(`   En el portal y no en la hoja (van al final, por fecha de inicio): ${notInSheet.length}`); notInSheet.forEach(c => console.log(`   ${c.full_name}`));
  console.log(`\n3. Por confirmar: ${doubtful.length}`); doubtful.forEach(d => console.log(`   fila ${d.s.order} ${d.s.name}: ${d.why}`));
  const sd = matches.filter(m => m.c.start_date && m.c.start_date !== m.start), nw = matches.filter(m => !m.c.start_date);
  console.log(`\n4. Fechas: inicios que cambian ${sd.length} · inicios nuevos ${nw.length} · fines que cambian/nuevos ${matches.filter(m => m.c.end_date !== m.end).length}`);
  matches.filter(m => m.startNote || m.endNote?.includes('hoja dice')).forEach(m => console.log(`   ${m.s.name}: inicio ${m.start}${m.startNote ? ' (' + m.startNote + ')' : ''} · fin ${m.end}${m.endNote ? ' (' + m.endNote + ')' : ''}`));
  console.log(`\n5. Coach principal: propuestas ${proposals.length} · empates ${ties.length} · sin coach ni llamadas ${noCoach.length}`);
  proposals.forEach(p => console.log(`   ${p.c.full_name} → ${coachName(p.coachId)} (${p.why})`));
  ties.forEach(t => console.log(`   EMPATE ${t.c.full_name}: ${t.calls.map(x => `${coachName(x.coach_id)}×${x.n}`).join(', ')}`));
  noCoach.forEach(c => console.log(`   SIN COACH ${c.full_name}`));

  if (!APPLY) { console.log('\nDry-run: no se escribió nada. Repite con --apply para aplicar.'); process.exit(0); }

  // ---------- respaldo y escritura
  const dir = new URL('../backups/', import.meta.url); fs.mkdirSync(dir, { recursive: true });
  const file = new URL(`clientes-antes-sync-hoja-${new Date().toISOString().slice(0, 10)}-${Date.now()}.csv`, dir);
  const q = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  fs.writeFileSync(file, '﻿' + ['id,full_name,entry_order,start_date,end_date,primary_coach_id', ...clients.map(c => [c.id, c.full_name, c.entry_order, c.start_date, c.end_date, primaryOf(c.id)].map(q).join(','))].join('\n'));
  console.log(`\nRespaldo: backups/${file.pathname.split('/').pop()}`);
  await sql.transaction(async tx => {
    await tx`update public.clients set entry_order = null where id = any(${clients.map(c => c.id)}::uuid[])`;
    for (const m of matches) await tx`update public.clients set entry_order = ${m.s.order}, start_date = ${m.start}::date, end_date = ${m.end}::date, updated_at = now() where id = ${m.c.id}::uuid`;
    let next = sheet.length;
    for (const c of [...notInSheet].sort((a, b) => String(a.start_date ?? '9').localeCompare(String(b.start_date ?? '9')))) await tx`update public.clients set entry_order = ${++next} where id = ${c.id}::uuid`;
    for (const p of proposals) {
      await tx`insert into public.coach_client_assignments (coach_id, client_id, is_primary) values (${p.coachId}::uuid, ${p.c.id}::uuid, true)
        on conflict (coach_id, client_id) do update set is_primary = true`;
    }
  });
  const missing = await sql`select c.full_name from public.clients c where not exists (select 1 from public.coach_client_assignments a where a.client_id = c.id and a.is_primary) order by 1`;
  console.log('Listo: orden de entrada, fechas y coach principal guardados.');
  if (missing.length) console.log(`Atención: ${missing.length} clientes siguen sin coach principal: ${missing.map(m => m.full_name).join(', ')}`);
} finally {
  await sql.end();
}
