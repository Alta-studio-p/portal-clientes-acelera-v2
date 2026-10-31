'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, ExternalLink, Pencil, Plus, Search, X } from 'lucide-react';
import { MetricCard, PageHeading, PeriodBar, SegmentedControl, TableCard, pillField, pillIconButton, tableBody, tableFoot, tableHead, tableHeadCell, tableRow } from '@/components/page-kit';
import { saveFee } from '@/app/admin/fees/actions';
import { SHORT_CALL_MINUTES } from '@/lib/call-hours.mjs';
import { CALL_HOURLY_RATE, currentMonth, feeDate, money, monthBounds, MATCH_METHOD_LABELS, PAYMENT_TYPES, safeRecordingUrl, type FeeRow } from '@/lib/coach-fees';

type Option = { id: string; name: string };
const field = 'h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const number = (value: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value);

export function CoachFeesDashboard({ coaches, coachId, month, rows, clients, allClients, readOnly = false, basePath, clientBasePath }: {
  coaches: Option[]; coachId: string; month: string; rows: FeeRow[]; clients: Option[]; allClients?: Option[]; readOnly?: boolean; basePath?: string; clientBasePath?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<FeeRow | null>(null);
  const coachName = coaches.find(c => c.id === coachId)?.name ?? 'Coach';
  const filtered = rows.filter(r =>
    (!client || r.client_id === client) &&
    (status === 'all' || (status === 'paid' ? !!r.paid_on : status === 'pending' ? r.amount !== null && !r.paid_on : r.amount === null)) &&
    `${r.client_name} ${r.topic}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))
  );
  const total = filtered.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const paid = filtered.reduce((sum, r) => sum + (r.paid_on ? r.amount ?? 0 : 0), 0);
  const hours = filtered.reduce((sum, r) => sum + (r.hours ?? 0), 0);
  const unpriced = filtered.filter(r => r.amount === null).length;
  const monthLabel = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  function navigate(nextCoach: string, nextMonth: string) {
    startTransition(() => router.push(readOnly ? `${basePath ?? '/coach/fees'}?month=${nextMonth}` : `/admin/fees?coach=${encodeURIComponent(nextCoach)}&month=${nextMonth}`));
  }
  function exportCsv() {
    const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
    const header = ['Coach', 'Fecha', 'Cliente', 'Tema trabajado', 'Horas', 'Valor COP', 'Tipo de pago', 'Fecha de pago', 'Grabación', 'Estado'];
    const data = filtered.map(r => [coachName, r.service_date, r.client_name, r.topic,
      r.hours === null ? '' : String(r.hours), r.amount === null ? '' : String(r.amount),
      PAYMENT_TYPES.find(p => p.value === r.payment_type)?.label ?? '', r.paid_on ?? '', r.recording_url && safeRecordingUrl(r.recording_url) ? r.recording_url : '',
      r.paid_on ? 'Pagado' : r.amount === null ? 'Por valorar' : 'Pendiente']);
    const url = URL.createObjectURL(new Blob(['\uFEFF' + [header, ...data].map(r => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `llamadas-${coachName.replace(/[^\p{L}\p{N} -]/gu, '')}-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  return <div className="mx-auto max-w-[1600px]" aria-busy={pending}>
    <PageHeading kicker={readOnly ? coachName : 'Administración'} title={readOnly ? 'Mis llamadas' : 'Llamadas de coaches'}
      actions={!readOnly ? <button disabled={pending} onClick={() => setEditing({ id: null, call_id: null, coach_id: coachId, client_id: null, client_name: '', service_date: month === currentMonth() ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) : monthBounds(month).from, topic: '', hours: null, amount: null, payment_type: null, paid_on: null, recording_url: null, client_match_method: null, client_coach_name: null, coach_needs_confirmation: false, duration_minutes: null })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"><Plus size={18} />Registrar actividad</button> : undefined} />

    <div className="space-y-5">
      {!readOnly && <SegmentedControl label="Coach" options={coaches.map(c => ({ value: c.id, label: c.name }))} value={coachId} disabled={pending} onChange={id => { setClient(''); navigate(id, month); }} />}
      <PeriodBar label="Periodo" month={month} currentMonth={currentMonth()} disabled={pending} previousTitle="Mes anterior" nextTitle="Mes siguiente"
        onChange={next => { if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(next)) navigate(coachId, next); }}
        actions={<button onClick={exportCsv} disabled={!filtered.length || pending} className={`${pillIconButton} disabled:opacity-40`} title="Exportar CSV" aria-label="Exportar CSV"><Download size={18} /></button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Horas registradas', number(hours), `${filtered.length} actividades`],
          ['Honorarios registrados', money(total), `${unpriced} por valorar`],
          ['Pagado', money(paid), `${filtered.filter(r => r.paid_on).length} ${filtered.filter(r => r.paid_on).length === 1 ? 'actividad pagada' : 'actividades pagadas'}`],
          ['Por pagar', money(total - paid), `${filtered.filter(r => r.amount !== null && !r.paid_on).length} pendientes`],
        ].map(([label, value, hint]) => <MetricCard key={label} label={label} value={value} hint={hint} />)}
      </div>
    </div>

    <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-base font-semibold">{coachName}</h2><p className="mt-1 text-sm text-muted">{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</p></div>
      <div className="flex w-full flex-wrap gap-3 lg:w-auto">
        <label className="relative min-w-0 flex-1 lg:w-60"><span className="sr-only">Buscar cliente o tema</span><Search size={16} className="absolute left-3 top-3.5 text-muted" /><input type="search" className={`${pillField} pl-9`} placeholder="Buscar cliente o tema" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label className="w-full sm:w-44"><span className="sr-only">Filtrar por cliente</span><select className={pillField} value={client} onChange={e => setClient(e.target.value)}><option value="">Todos los clientes</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="w-full sm:w-40"><span className="sr-only">Filtrar por estado</span><select className={pillField} value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="unpriced">Por valorar</option></select></label>
      </div>
    </div>

    <TableCard label="Tabla de llamadas">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <caption className="sr-only">Llamadas de {coachName} en {monthLabel}</caption>
        <thead className={tableHead}><tr>{['Fecha', 'Cliente', 'Tema trabajado', 'Horas', 'Valor', 'Tipo de pago', 'Fecha de pago', 'Estado', 'Grabación', ...(!readOnly ? [''] : [])].map((h, i) => <th key={i} scope="col" className={`${tableHeadCell} ${i === 3 || i === 4 ? 'text-right' : ''}`}>{h || <span className="sr-only">Acciones</span>}</th>)}</tr></thead>
        <tbody className={tableBody}>
          {filtered.map(r => <tr key={r.call_id ?? r.id} className={tableRow}>
            <td className="whitespace-nowrap px-5 py-4 tabular-nums">{feeDate(r.service_date)}</td>
            <td className="max-w-52 px-5 py-4 font-medium">{r.client_id ? <Link href={`${clientBasePath ?? `/${readOnly ? 'coach' : 'admin'}/clients`}/${r.client_id}`} title={r.client_match_method ? MATCH_METHOD_LABELS[r.client_match_method] : undefined} className="hover:text-accent hover:underline">{r.client_name}</Link> : <span className="text-muted">{r.client_name}</span>}{r.client_coach_name && <span className="mt-0.5 block text-xs font-normal text-muted">Cliente de {r.client_coach_name}</span>}</td>
            <td className="min-w-48 max-w-80 px-5 py-4"><span className="line-clamp-2" title={r.topic}>{r.topic}</span>{!r.call_id && <span className="mt-1 block text-xs text-muted">Actividad manual</span>}{r.duration_minutes !== null && <span className="mt-1 block text-xs text-muted">Fathom: {r.duration_minutes} min{r.duration_minutes < SHORT_CALL_MINUTES ? ' · muy corta, revisar' : ''}</span>}{r.coach_needs_confirmation && <span className="mt-1 block text-xs font-medium text-[var(--status-extension)]">Coach por confirmar</span>}</td>
            <td className="px-5 py-4 text-right tabular-nums">{r.hours === null ? '—' : number(r.hours)}</td>
            <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums">{r.amount === null ? '—' : money(r.amount)}</td>
            <td className="px-5 py-4 text-muted">{PAYMENT_TYPES.find(p => p.value === r.payment_type)?.label ?? '—'}</td>
            <td className="whitespace-nowrap px-5 py-4">{r.paid_on ? feeDate(r.paid_on) : '—'}</td>
            <td className="px-5 py-4"><span className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${r.paid_on ? 'bg-[var(--status-active-bg)] text-[var(--status-active)]' : r.amount === null ? 'bg-surface-muted text-muted' : 'bg-[var(--status-extension-bg)] text-[var(--status-extension)]'}`}>{r.paid_on ? 'Pagado' : r.amount === null ? 'Por valorar' : 'Pendiente'}</span></td>
            <td className="px-5 py-2">{r.recording_url && safeRecordingUrl(r.recording_url) ? <a href={r.recording_url} target="_blank" rel="noopener noreferrer" aria-label={`Ver grabación de ${r.client_name} del ${feeDate(r.service_date)}`} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap text-accent hover:underline">Ver grabación<ExternalLink size={14} /></a> : <span className="text-muted">Grabación no disponible</span>}</td>
            {!readOnly && <td className="px-3 py-2"><button className={iconButton} title="Editar actividad" aria-label={`Editar ${r.topic} de ${r.client_name}`} onClick={() => setEditing(r)} disabled={pending}><Pencil size={16} /></button></td>}
          </tr>)}
          {!filtered.length && <tr><td colSpan={readOnly ? 9 : 10} className="px-6 py-16 text-center text-muted">{rows.length ? 'No hay actividades con estos filtros.' : 'No hay actividades registradas en este periodo.'}</td></tr>}
        </tbody>
        {!!filtered.length && <tfoot className={tableFoot}><tr><th colSpan={3} scope="row" className="px-5 py-4">Total · {filtered.length} actividades</th><td className="px-5 py-4 text-right tabular-nums">{number(hours)}</td><td className="whitespace-nowrap px-5 py-4 text-right tabular-nums">{money(total)}</td><td colSpan={readOnly ? 4 : 5} /></tr></tfoot>}
      </table>
    </TableCard>
    <p className="mt-3 text-xs text-muted" role="status">{pending ? 'Cargando periodo…' : `${filtered.length} de ${rows.length} actividades`}</p>
    {!readOnly && editing && <FeeEditor key={editing.call_id ?? editing.id ?? 'new'} row={editing} clients={allClients ?? clients} coaches={coaches} onClose={() => setEditing(null)} />}
  </div>;
}

function FeeEditor({ row, clients, coaches, onClose }: { row: FeeRow; clients: Option[]; coaches: Option[]; onClose: () => void }) {
  const [clientQuery, setClientQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveFee, { error: null, success: false });
  const [draft, setDraft] = useState({
    serviceDate: row.service_date, clientId: row.client_id ?? '', topic: row.topic,
    hours: row.hours === null ? '' : String(row.hours), amount: row.amount === null ? '' : String(row.amount),
    paymentType: row.payment_type ?? '', paidOn: row.paid_on ?? '', callCoachId: row.coach_id,
  });
  function change(key: keyof typeof draft, value: string) {
    setDraft(current => ({ ...current, [key]: value,
      ...(key === 'hours' && row.call_id ? { amount: value === '' ? '' : String(Math.round(Number(value) * CALL_HOURLY_RATE * 100) / 100) } : {}),
    }));
  }
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (state.success) onClose(); }, [state.success, onClose]);
  return <dialog ref={dialog} aria-label={row.call_id || row.id ? 'Editar actividad' : 'Registrar actividad'} onCancel={e => { if (pending) e.preventDefault(); else onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40">
    <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-lg font-semibold">{row.call_id || row.id ? 'Editar actividad' : 'Registrar actividad'}</h2><button disabled={pending} onClick={onClose} className={iconButton} title="Cerrar" aria-label="Cerrar"><X size={18} /></button></div>
    <form action={action} className="p-5">
      <input type="hidden" name="id" value={row.id ?? ''} /><input type="hidden" name="callId" value={row.call_id ?? ''} /><input type="hidden" name="coachId" value={row.coach_id} />
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Fecha<input name="serviceDate" type="date" required value={draft.serviceDate} onChange={e => change('serviceDate', e.target.value)} className={`${field} mt-1.5`} /></label>
        <div className="text-sm"><label>Cliente<input type="search" aria-label="Buscar cliente" placeholder="Buscar cliente…" value={clientQuery} onChange={e => setClientQuery(e.target.value)} className={`${field} mt-1.5`} /></label>
          <select aria-label="Cliente" name="clientId" value={draft.clientId} onChange={e => change('clientId', e.target.value)} className={`${field} mt-2`}><option value="">Sin cliente vinculado</option>{clients.filter(c => c.id === draft.clientId || normalize(c.name).includes(normalize(clientQuery))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        {row.call_id && <label className="text-sm">Coach de la llamada<select aria-label="Coach de la llamada" name="callCoachId" value={draft.callCoachId} onChange={e => change('callCoachId', e.target.value)} className={`${field} mt-1.5`}>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <label className="text-sm sm:col-span-2">Tema trabajado<input name="topic" required maxLength={500} value={draft.topic} onChange={e => change('topic', e.target.value)} className={`${field} mt-1.5`} /></label>
        <label className="text-sm">Número de horas<input name="hours" type="number" min="0.01" max="9999" step="0.01" value={draft.hours} onChange={e => change('hours', e.target.value)} className={`${field} mt-1.5`} /></label>
        <label className="text-sm">Valor (COP)<input name="amount" type="number" min="0" max="999999999999" step="0.01" value={draft.amount} onChange={e => change('amount', e.target.value)} className={`${field} mt-1.5`} /></label>
        <label className="text-sm">Tipo de pago<select aria-label="Tipo de pago" name="paymentType" value={draft.paymentType} onChange={e => change('paymentType', e.target.value)} className={`${field} mt-1.5`}><option value="">Sin especificar</option>{PAYMENT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="text-sm">Fecha de pago<input name="paidOn" type="date" value={draft.paidOn} onChange={e => change('paidOn', e.target.value)} className={`${field} mt-1.5`} /></label>
      </fieldset>
      {state.error && <p role="alert" className="mt-4 rounded-md bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger)]">{state.error}</p>}
      <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-surface-muted">Cancelar</button><button disabled={pending} type="submit" className="min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">{pending ? 'Guardando…' : 'Guardar actividad'}</button></div>
    </form>
  </dialog>;
}
