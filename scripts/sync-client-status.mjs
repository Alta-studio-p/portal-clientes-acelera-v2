// Muestra (y con --apply aplica) los cambios de estado guardado según la fecha de fin.
//   node --env-file=.env.local scripts/sync-client-status.mjs [--apply]
// Con --apply guarda antes un respaldo en backups/ y ejecuta sync_client_program_status() (requiere setup:program-status).
import fs from 'node:fs';
import { createSqlClient } from '../lib/postgres.mjs';
import { programPhase, storedStatusFor } from '../lib/program-phase.mjs';

const APPLY = process.argv.includes('--apply');
const NAMES = { active: 'Activo', inactive: 'Finalizado', extension: 'Extensión' };
const PHASE = { activo: 'Activo', recien: 'Recién finalizado (Activos)', finalizado: 'Finalizado' };
const sql = createSqlClient();
try {
  const [{ today }] = await sql`select ((now() at time zone 'America/Bogota')::date)::text as today`;
  const rows = await sql`select c.id::text, c.entry_order, c.full_name, c.status::text, c.end_date::text, coalesce(co.full_name, '—') coach
    from public.clients c left join public.coach_client_assignments a on a.client_id = c.id and a.is_primary left join public.coaches co on co.id = a.coach_id order by c.entry_order nulls last`;
  const info = rows.map(r => ({ ...r, ...programPhase({ status: r.status, endDate: r.end_date }, today) }));
  const changes = info.filter(r => storedStatusFor(r.status, r.phase) !== r.status);
  console.log(`Hoy (Bogotá): ${today} · ${rows.length} clientes\n`);
  console.log(`Clientes cuyo estado cambiaría: ${changes.length}`);
  console.table(changes.map(r => ({ cliente: r.full_name, coach: r.coach, fin: r.end_date, 'días hasta(+)/desde(−) el fin': r.days, 'estado hoy': NAMES[r.status], 'estado nuevo': PHASE[r.phase] })));
  const nodate = info.filter(r => !r.end_date), manual = info.filter(r => r.manual);
  console.log(`Sin fecha de fin (se dejan como están): ${nodate.length}`); nodate.forEach(r => console.log(`   ${r.full_name} · ${NAMES[r.status]}`));
  console.log(`Marcados Finalizado a mano antes de su fecha de fin (se respetan): ${manual.length}`); manual.forEach(r => console.log(`   ${r.full_name} · fin ${r.end_date} (en ${r.days} días)`));
  const tally = {}; info.forEach(r => { tally[PHASE[r.phase]] = (tally[PHASE[r.phase]] ?? 0) + 1; });
  console.log('\nResultado por fase:', tally);
  console.log('Con etiqueta "Finalizó hace X días":', info.filter(r => r.phase === 'recien').map(r => `${r.full_name} (${r.tag.text})`).join('; ') || '—');
  console.log('Con etiqueta "Termina en X días":', info.filter(r => r.tag?.tone === 'soon').map(r => `${r.full_name} (${r.tag.text})`).join('; ') || '—');
  if (!APPLY) { console.log('\nDry-run: no se escribió nada. Repite con --apply para aplicar.'); process.exit(0); }
  const dir = new URL('../backups/', import.meta.url); fs.mkdirSync(dir, { recursive: true });
  const file = new URL(`estado-clientes-antes-sync-${today}-${Date.now()}.csv`, dir);
  const q = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  fs.writeFileSync(file, '﻿' + ['id,full_name,status,end_date', ...rows.map(r => [r.id, r.full_name, r.status, r.end_date].map(q).join(','))].join('\n'));
  console.log(`\nRespaldo: backups/${file.pathname.split('/').pop()}`);
  const [{ n }] = await sql`select public.sync_client_program_status() as n`;
  console.log(`Listo: ${n} clientes actualizados por la función de la base.`);
  if (n !== changes.length) console.log(`Atención: la base cambió ${n} y el cálculo local esperaba ${changes.length}. Revisar.`);
} finally { await sql.end(); }
