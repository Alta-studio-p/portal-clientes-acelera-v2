'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { Pencil, Save, TriangleAlert, Search, X } from 'lucide-react';
import { saveProgressClient, type ProgressState } from '@/lib/actions/client-progress';
import { ClientStateSelector } from '@/components/client-state-selector';
import { programPhase, storedStatusFor } from '@/lib/program-phase.mjs';
import { MetricCard, PeriodBar, SegmentedControl, TableCard, pillField, pillIconButton, tableBody, tableFoot, tableHead, tableHeadCell, tableRow } from '@/components/page-kit';
import { currentMonth } from '@/lib/coach-fees';
import { visibleClientEmail } from '@/lib/client-contact.mjs';
import { sessionProgress, SESSION_LIMIT, progressEndDate, formatProgressDate as formatDate, type ProgressClient, type ProgressCategory, type ProgressCoach } from '@/lib/client-progress';

const initial: ProgressState = { error: null, success: false };
const control = 'min-h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
const iconButton = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50';

function RowEditor({ client }: { client: ProgressClient }) {
  const [state, action, pending] = useActionState(saveProgressClient, initial);
  return <details className="min-w-36">
    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-1 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Editar inicio de ${client.name}`}>
      <span className="max-w-44 break-words">{formatDate(client.startDate)}</span><Pencil size={14} className="shrink-0 text-muted" />
    </summary>
    <form action={action} className="mt-2 space-y-2 pb-2">
      <input type="hidden" name="clientId" value={client.id} /><input type="hidden" name="field" value="start" />
      <div className="flex items-start gap-1">
        <input aria-label={`Fecha de inicio de ${client.name}`} className={`${control} w-40`} type="date" name="value" required min="1900-01-01" max="2200-12-31" defaultValue={client.startDate ?? ''} disabled={pending} />
        <button className={iconButton} disabled={pending} title={`Guardar inicio de ${client.name}`} aria-label={`Guardar inicio de ${client.name}`}><Save size={16} /></button>
      </div>
      {state.error && <p role="alert" className="max-w-56 text-xs text-red-700">{state.error}</p>}
      {state.success && <p role="status" className="text-xs text-accent">Guardado</p>}
    </form>
  </details>;
}

function PrimaryCoachEditor({ client, coaches, supportIds, readOnly }: { client: ProgressClient; coaches: [string, string][]; supportIds: Set<string>; readOnly: boolean }) {
  const [state, action, pending] = useActionState(saveProgressClient, initial);
  const name = client.primaryCoach || 'Sin coach';
  const options = coaches.filter(([id]) => !supportIds.has(id) || id === client.primaryCoachId);
  if (readOnly) return <span>{name}</span>;
  return <details>
    <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-md hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Cambiar coach principal de ${client.name}`}><span className="break-words">{name}</span><Pencil size={13} className="shrink-0" /></summary>
    <form action={action} className="mt-2 flex items-start gap-1 pb-1">
      <input type="hidden" name="clientId" value={client.id} /><input type="hidden" name="field" value="primary" />
      <select name="value" aria-label={`Coach principal de ${client.name}`} defaultValue={client.primaryCoachId ?? ''} required disabled={pending} className={`${control} w-36`}>
        <option value="" disabled>Elegir coach</option>{options.map(([id, coachName]) => <option key={id} value={id}>{coachName}</option>)}
      </select>
      <button className={iconButton} disabled={pending} title={`Guardar coach principal de ${client.name}`} aria-label={`Guardar coach principal de ${client.name}`}><Save size={16} /></button>
    </form>
    {state.error && <p role="alert" className="max-w-48 text-xs text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-xs text-accent">Guardado</p>}
  </details>;
}

type Estado = 'activos' | 'finalizados' | 'todos';
type Vista = 'lista' | 'resumen';
const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const coachSlug = (name: string) => norm(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const startMonth = (c: ProgressClient) => c.startDate?.slice(0, 7) ?? '';
const average = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const SORTS = ['entry', 'end-near', 'start-asc', 'start-desc', 'progress-desc', 'progress-asc', 'last', 'name'];

function summarize(list: ProgressClient[], done: (c: ProgressClient) => boolean) {
  return {
    active: list.filter(c => !done(c)).length, done: list.filter(done).length, total: list.length,
    avg: list.length ? list.reduce((sum, c) => sum + c.calls, 0) / list.length : 0,
    below: list.filter(c => c.calls < SESSION_LIMIT).length, complete: list.filter(c => c.calls >= SESSION_LIMIT).length, over: list.filter(c => c.calls > SESSION_LIMIT).length,
  };
}

export function ClientProgressDashboard({ clients, categories, coaches = [], today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), isAdmin, basePath = '/admin', readOnly = false, initialCoach = '', initialSearch = '' }: {
  clients: ProgressClient[]; categories: ProgressCategory[]; coaches?: ProgressCoach[]; today?: string; isAdmin: boolean; basePath?: string; readOnly?: boolean; initialCoach?: string; initialSearch?: string;
}) {
  const pathname = usePathname();
  // Estado por fecha de fin, calculado con la fecha de hoy cada vez que se carga la vista.
  const phases = useMemo(() => new Map(clients.map(c => [c.id, programPhase({ status: c.operationalStatus, endDate: c.endDate }, today)] as const)), [clients, today]);
  const finished = (c: ProgressClient) => phases.get(c.id)?.phase === 'finalizado';
  const statusOf = (c: ProgressClient) => storedStatusFor(c.operationalStatus, phases.get(c.id)?.phase ?? 'activo');
  const params = useSearchParams();
  const coachOptions = useMemo(() => [...new Map([...coaches.map(c => [c.id, c.name] as const), ...clients.flatMap(c => c.coachIds.map((id, i) => [id, c.coaches[i] ?? id] as const))]).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')), [clients, coaches]);
  const supportIds = useMemo(() => new Set(coaches.filter(c => c.isSupport).map(c => c.id)), [coaches]);
  const pillCoaches = useMemo(() => (coaches.length ? coaches.map(c => [c.id, c.name] as const) : coachOptions), [coaches, coachOptions]);
  // Filtros guardados en la URL (?coach=ross&estado=activos&mes=2026-10&vista=resumen) para que sobrevivan a recargar o compartir.
  const slugToId = useMemo(() => new Map(coachOptions.flatMap(([id, name]) => [[id, id], [coachSlug(name), id]] as const)), [coachOptions]);
  const get = (key: string) => params.get(key) ?? '';
  const [coach, setCoach] = useState(() => slugToId.get((get('coach') || initialCoach).toLowerCase()) ?? '');
  const [estado, setEstado] = useState<Estado>(() => (['activos', 'finalizados', 'todos'] as const).find(e => e === get('estado')) ?? 'activos');
  const [mes, setMes] = useState(() => (/^\d{4}-(0[1-9]|1[0-2])$/.test(get('mes')) ? get('mes') : ''));
  const [vista, setVista] = useState<Vista>(() => (isAdmin && get('vista') === 'resumen' ? 'resumen' : 'lista'));
  const [includeSecondary, setIncludeSecondary] = useState(() => get('secundarios') === '1');
  const [search, setSearch] = useState(() => get('q') || initialSearch);
  const [category, setCategory] = useState(() => get('categoria'));
  const [sessions, setSessions] = useState(() => (['progress', 'complete', 'excess'].includes(get('sesiones')) ? get('sesiones') : ''));
  const [sort, setSort] = useState(() => (SORTS.includes(get('orden')) ? get('orden') : 'entry'));
  useEffect(() => {
    const q = new URLSearchParams();
    if (coach) q.set('coach', coachSlug(coachOptions.find(([id]) => id === coach)?.[1] ?? coach));
    if (estado !== 'activos') q.set('estado', estado);
    if (mes) q.set('mes', mes);
    if (vista === 'resumen') q.set('vista', 'resumen');
    if (includeSecondary) q.set('secundarios', '1');
    if (search) q.set('q', search);
    if (category) q.set('categoria', category);
    if (sessions) q.set('sesiones', sessions);
    if (sort !== 'entry') q.set('orden', sort);
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, coachOptions, coach, estado, mes, vista, includeSecondary, search, category, sessions, sort]);

  const inCoach = (c: ProgressClient, id = coach) => !id || c.primaryCoachId === id || (includeSecondary && c.alsoCoachIds.includes(id));
  const inEstado = (c: ProgressClient, e: Estado = estado) => e === 'todos' || (e === 'finalizados' ? finished(c) : !finished(c));
  const inMonth = (c: ProgressClient) => !mes || startMonth(c) === mes;
  const visible = useMemo(() => clients.filter(c => {
    const p = sessionProgress(c.calls);
    return inMonth(c) && inEstado(c) && inCoach(c) &&
      (!search || `${c.name} ${c.email??''} ${c.display_email??''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))) &&
      (!category || (category === 'none' ? c.categoryIds.length === 0 : category.startsWith('program:') ? statusOf(c) === category.slice(8) : c.categoryIds.includes(category))) &&
      (!sessions || (sessions === 'excess' ? p.excess > 0 : sessions === 'complete' ? p.sessions >= SESSION_LIMIT : p.sessions < SESSION_LIMIT));
  }).sort((a, b) => {
    let order = 0;
    if (sort === 'entry') order = (a.entryOrder ?? 1e9) - (b.entryOrder ?? 1e9);
    else if (sort === 'end-near') order = Math.abs(phases.get(a.id)?.days ?? 1e9) - Math.abs(phases.get(b.id)?.days ?? 1e9);
    else if (sort === 'name') order = a.name.localeCompare(b.name, 'es');
    else if (sort.startsWith('progress')) order = (a.calls - b.calls) * (sort.endsWith('desc') ? -1 : 1);
    else {
      const left = sort === 'last' ? a.lastCall : a.startDate;
      const right = sort === 'last' ? b.lastCall : b.startDate;
      if (!left || !right) order = !left && !right ? 0 : !left ? 1 : -1;
      else order = left.localeCompare(right) * (sort === 'last' || sort === 'start-desc' ? -1 : 1);
    }
    return order || a.name.localeCompare(b.name, 'es');
  }), [clients, phases, search, coach, includeSecondary, category, sessions, sort, estado, mes]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = useMemo(() => [...new Set(clients.map(startMonth).filter(Boolean))], [clients]);
  const coachRows = useMemo(() => {
    const inMes = clients.filter(c => !mes || startMonth(c) === mes);
    const rows = pillCoaches.map(([id, name]) => ({ id, name, ...summarize(inMes.filter(c => c.primaryCoachId === id), finished) }));
    const none = inMes.filter(c => !c.primaryCoachId);
    return { rows: [...rows, ...(none.length ? [{ id: '', name: 'Sin coach', ...summarize(none, finished) }] : [])], total: summarize(inMes, finished) };
  }, [clients, pillCoaches, mes, phases]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = {
    all: clients.filter(c => inMonth(c) && inEstado(c)).length,
    coach: (id: string) => clients.filter(c => inMonth(c) && inEstado(c) && inCoach(c, id)).length,
    estado: (e: Estado) => clients.filter(c => inMonth(c) && inCoach(c) && inEstado(c, e)).length,
  };
  const reset = () => { setCoach(''); setEstado('activos'); setMes(''); setSearch(''); setCategory(''); setSessions(''); setSort('entry'); setIncludeSecondary(false); };
  const openCoach = (id: string) => { setCoach(id); setVista('lista'); };
  const stats = summarize(visible, finished);
  return <div className="space-y-4">
    <header><h1 className="text-2xl font-semibold leading-tight">Progreso de clientes</h1></header>

    <div className="grid grid-cols-2 gap-x-6 gap-y-1 lg:grid-cols-4">
      {([['Clientes', visible.length], ['Menos de 12 sesiones', stats.below], ['12 sesiones o más', stats.complete], ['Superan 12 sesiones', stats.over]] as const).map(([label, count]) =>
        <MetricCard key={label} label={label} value={<span className={label === 'Superan 12 sesiones' && count ? 'text-red-700' : ''}>{count}</span>} />)}
    </div>

    {isAdmin && <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
        <SegmentedControl hideLabel collapseAfter={20} label="Coach" value={coach} onChange={setCoach}
          options={[{ value: '', label: `Todos (${counts.all})` }, ...pillCoaches.map(([id, name]) => ({ value: id, label: `${name} (${counts.coach(id)})` }))]} />
        <label className="flex min-h-10 items-center gap-2 text-xs text-muted"><input type="checkbox" checked={includeSecondary} onChange={e => setIncludeSecondary(e.target.checked)} className="h-4 w-4 accent-[--accent]" />Incluir clientes donde es secundario</label>
      </div>
      <SegmentedControl hideLabel compact label="Vista" value={vista} onChange={v => setVista(v as Vista)} options={[{ value: 'resumen', label: 'Resumen por coach' }, { value: 'lista', label: 'Lista de clientes' }]} />
    </div>}

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <SegmentedControl hideLabel compact label="Estado de los clientes" value={estado} onChange={v => setEstado(v as Estado)}
      options={[{ value: 'activos', label: `Activos (${counts.estado('activos')})` }, { value: 'finalizados', label: `Finalizados (${counts.estado('finalizados')})` }, { value: 'todos', label: `Todos (${counts.estado('todos')})` }]} />

    <PeriodBar compact label="Mes de inicio:" month={mes} currentMonth={currentMonth()} months={months} allLabel="Todos los meses" previousTitle="Mes anterior" nextTitle="Mes siguiente" onChange={setMes}
      actions={<button onClick={reset} className={pillIconButton} title="Limpiar filtros" aria-label="Limpiar filtros"><X size={16} /></button>} />
    </div>

    {vista === 'resumen' && isAdmin ? <section aria-label="Resumen por coach">
      <TableCard label="Resumen por coach">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className={tableHead}><tr>{['Coach', 'Activos', 'Finalizados', 'Total clientes', 'Sesiones promedio', 'Menos de 12', '12 o más', 'Superan 12'].map((h, i) => <th key={h} scope="col" className={`${tableHeadCell} ${i ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody className={tableBody}>{coachRows.rows.map(r => <tr key={r.id || 'none'} className={tableRow}>
            <td className="px-5 py-4 font-medium">{r.id ? <button onClick={() => openCoach(r.id)} className="hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent" title={`Ver clientes de ${r.name}`}>{r.name}</button> : <span className="text-muted">{r.name}</span>}</td>
            {[r.active, r.done, r.total, average.format(r.avg), r.below, r.complete, r.over].map((v, i) => <td key={i} className="px-5 py-4 text-right tabular-nums">{v}</td>)}
          </tr>)}</tbody>
          <tfoot className={tableFoot}><tr><th scope="row" className="px-5 py-4 text-left uppercase tracking-wider">Total</th>
            {[coachRows.total.active, coachRows.total.done, coachRows.total.total, average.format(coachRows.total.avg), coachRows.total.below, coachRows.total.complete, coachRows.total.over].map((v, i) => <td key={i} className="px-5 py-4 text-right tabular-nums">{v}</td>)}</tr></tfoot>
        </table>
      </TableCard>
    </section> : <section aria-label="Lista de clientes" className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 border-b border-border pb-5 [&>label]:w-full sm:[&>label]:w-auto [&_select]:w-full [&_select]:max-w-full" role="search" aria-label="Filtros de progreso">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted">Cliente<div className="relative"><Search className="absolute left-3 top-3 text-muted" size={16} /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o correo" className={`${pillField} w-full pl-9`} /></div></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Estado<select value={category} onChange={e => setCategory(e.target.value)} className={`${pillField} max-w-52`}><option value="">Todos los estados</option><option value="program:active">Activo</option><option value="program:extension">En extensión</option><option value="program:inactive">Inactivo</option><option value="none">Sin etiquetas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.label}{!c.active ? ' (retirado)' : ''}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Sesiones<select value={sessions} onChange={e => setSessions(e.target.value)} className={pillField}><option value="">Todas</option><option value="progress">Menos de 12</option><option value="complete">12 o más</option><option value="excess">Más de 12 · alerta</option></select></label>
        <label className="flex flex-col gap-1 text-xs text-muted">Ordenar por<select value={sort} onChange={e => setSort(e.target.value)} className={`${pillField} max-w-56`}><option value="entry">Orden de entrada (como la base)</option><option value="end-near">Fecha de fin más próxima</option><option value="start-asc">Inicio · más antiguo</option><option value="start-desc">Inicio · más reciente</option><option value="progress-desc">Progreso · mayor primero</option><option value="progress-asc">Progreso · menor primero</option><option value="last">Última llamada · reciente</option><option value="name">Nombre · A a Z</option></select></label>
      </div>
      <div className="flex items-center justify-between"><p role="status" className="text-sm text-muted">{visible.length} de {clients.length} clientes</p><span className="text-xs text-muted">Meta: {SESSION_LIMIT} sesiones</span></div>
      <TableCard label="Tabla de clientes">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className={tableHead}><tr>{['Cliente', ...(isAdmin ? ['Coach'] : []), 'Progreso', 'Sesiones', 'Inicio', 'Fin', 'Última llamada', 'Estado'].map(h => <th key={h} scope="col" className={tableHeadCell}>{h}</th>)}</tr></thead>
          <tbody className={tableBody}>{visible.map(client => {
            const p = sessionProgress(client.calls);
            return <tr key={client.id} className={`align-top ${tableRow}`}>
              <td className="px-5 py-4"><Link prefetch={false} href={`${basePath}/clients/${client.id}`} className={`flex min-h-10 max-w-60 items-center gap-2 font-medium hover:underline ${p.excess ? 'text-red-700' : 'text-foreground'}`}>
                {p.excess > 0 && <TriangleAlert size={16} className="shrink-0" aria-label="Excede 12 sesiones" />}<span className="break-words">{client.name}</span></Link><p className="mt-0.5 max-w-60 break-words text-xs text-muted [overflow-wrap:anywhere]">{visibleClientEmail(client) || 'Sin correo registrado'}</p>{p.excess > 0 && <p className="text-xs text-red-700">{p.excess} {p.excess === 1 ? 'sesión' : 'sesiones'} sobre el límite</p>}</td>
              {isAdmin && <td className="max-w-48 px-5 py-4 text-muted"><PrimaryCoachEditor key={`${client.id}-${client.primaryCoachId}`} client={client} coaches={coachOptions} supportIds={supportIds} readOnly={readOnly} />{client.alsoCoaches.length > 0 && <p className="mt-0.5 text-xs text-muted-2">También: {client.alsoCoaches.join(', ')}</p>}</td>}
              <td className="px-5 py-5"><div className="flex w-40 items-center gap-3"><div role="progressbar" aria-label={`Progreso de ${client.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-valuetext={`${p.sessions} de ${SESSION_LIMIT} sesiones`} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"><div className={`h-full ${p.excess ? 'bg-red-600' : 'bg-accent'}`} style={{ width: `${p.percent}%` }} /></div><span className={`w-10 text-right font-semibold tabular-nums ${p.excess ? 'text-red-700' : ''}`}>{p.percent}%</span></div></td>
              <td className={`px-5 py-5 tabular-nums ${p.excess ? 'font-semibold text-red-700' : 'text-muted'}`}>{p.sessions} / {SESSION_LIMIT}</td>
              <td className="whitespace-nowrap px-5 py-4 text-muted">{readOnly ? formatDate(client.startDate) : <RowEditor key={`${client.id}-start-${client.startDate}`} client={client} />}</td>
              <td className="whitespace-nowrap px-5 py-5 text-muted">{formatDate(client.endDate ?? progressEndDate(client.startDate))}</td>
              <td className="whitespace-nowrap px-5 py-5 text-muted">{formatDate(client.lastCall)}</td>
              <td className="px-5 py-4"><ClientStateSelector client={client} categories={categories} isAdmin={isAdmin} readOnly={readOnly} status={statusOf(client)} phaseTag={phases.get(client.id)?.tag ?? null} /></td>
            </tr>;
          })}</tbody>
        </table>
        {!visible.length && <p className="px-4 py-10 text-center text-sm text-muted">No hay clientes que coincidan con estos filtros.</p>}
      </TableCard>
    </section>}
  </div>;
}
