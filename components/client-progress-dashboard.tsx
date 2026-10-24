'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { Pencil, Save, TriangleAlert, Search, X } from 'lucide-react';
import { saveProgressClient, type ProgressState } from '@/lib/actions/client-progress';
import { ClientStateSelector } from '@/components/client-state-selector';
import { sessionProgress, SESSION_LIMIT, progressEndDate, formatProgressDate as formatDate, type ProgressClient, type ProgressCategory } from '@/lib/client-progress';

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

export function ClientProgressDashboard({ clients, categories, isAdmin, basePath = '/admin', readOnly = false, initialCoach = '', initialSearch = '' }: {
  clients: ProgressClient[]; categories: ProgressCategory[]; isAdmin: boolean; basePath?: string; readOnly?: boolean; initialCoach?: string; initialSearch?: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [coach, setCoach] = useState(initialCoach);
  const [category, setCategory] = useState('');
  const [sessions, setSessions] = useState('');
  const [sort, setSort] = useState('start-asc');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const coachOptions = useMemo(() => [...new Map(clients.flatMap(c => c.coachIds.map((id,i) => [id,c.coaches[i] ?? id] as const))).entries()].sort((a,b) => a[1].localeCompare(b[1],'es')), [clients]);
  const visible = useMemo(() => clients.filter(c => {
    const p = sessionProgress(c.calls);
    return (!search || `${c.name} ${c.email}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))) &&
      (!coach || c.coachIds.includes(coach)) && (!category || (category === 'none' ? c.categoryIds.length === 0 : category.startsWith('program:') ? c.operationalStatus === category.slice(8) : c.categoryIds.includes(category))) &&
      (!sessions || (sessions === 'excess' ? p.excess > 0 : sessions === 'complete' ? p.sessions >= SESSION_LIMIT : p.sessions < SESSION_LIMIT)) &&
      (!from || (!!c.startDate && c.startDate >= from)) && (!to || (!!c.startDate && c.startDate <= to));
  }).sort((a,b) => {
    let order = 0;
    if (sort === 'name') order = a.name.localeCompare(b.name,'es');
    else if (sort.startsWith('progress')) order = (a.calls-b.calls) * (sort.endsWith('desc') ? -1 : 1);
    else {
      const left = sort === 'last' ? a.lastCall : a.startDate;
      const right = sort === 'last' ? b.lastCall : b.startDate;
      if (!left || !right) order = !left && !right ? 0 : !left ? 1 : -1;
      else order = left.localeCompare(right) * (sort === 'last' || sort === 'start-desc' ? -1 : 1);
    }
    return order || a.name.localeCompare(b.name,'es');
  }), [clients, search,coach,category,sessions,sort,from,to]);
  const over = clients.filter(c => c.calls > SESSION_LIMIT).length;
  const complete = clients.filter(c => c.calls >= SESSION_LIMIT).length;
  const reset = () => {setSearch('');setCoach('');setCategory('');setSessions('');setSort('start-asc');setFrom('');setTo('');};
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-semibold">Progreso de clientes</h1></header>
    <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
      {([['Clientes',clients.length],['Menos de 12 sesiones',clients.length-complete],['12 sesiones o más',complete],['Superan 12 sesiones',over]] as const).map(([label,count]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className={`mt-1 text-xl font-semibold tabular-nums ${label === 'Superan 12 sesiones' && count ? 'text-red-700' : ''}`}>{count}</dd></div>)}
    </dl>
    <section aria-label="Filtros de progreso" className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted">Cliente<div className="relative"><Search className="absolute left-3 top-3 text-muted" size={16} /><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre o correo" className={`${control} w-full pl-9`} /></div></label>
      {isAdmin && <label className="flex flex-col gap-1 text-xs text-muted">Coach<select value={coach} onChange={e=>setCoach(e.target.value)} className={`${control} max-w-48`}><option value="">Todos los coaches</option>{coachOptions.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
      <label className="flex flex-col gap-1 text-xs text-muted">Estado<select value={category} onChange={e=>setCategory(e.target.value)} className={`${control} max-w-52`}><option value="">Todos los estados</option><option value="program:active">Activo</option><option value="program:extension">En extensión</option><option value="program:inactive">Inactivo</option><option value="none">Sin etiquetas</option>{categories.map(c=><option key={c.id} value={c.id}>{c.label}{!c.active ? ' (retirado)' : ''}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Sesiones<select value={sessions} onChange={e=>setSessions(e.target.value)} className={control}><option value="">Todas</option><option value="progress">Menos de 12</option><option value="complete">12 o más</option><option value="excess">Más de 12 · alerta</option></select></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Inicio desde<input type="date" value={from} onInput={e=>setFrom(e.currentTarget.value)} onChange={e=>setFrom(e.target.value)} className={`${control} w-40`} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Inicio hasta<input type="date" value={to} min={from} onInput={e=>setTo(e.currentTarget.value)} onChange={e=>setTo(e.target.value)} className={`${control} w-40`} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Ordenar por<select value={sort} onChange={e=>setSort(e.target.value)} className={`${control} max-w-56`}><option value="start-asc">Inicio · más antiguo</option><option value="start-desc">Inicio · más reciente</option><option value="progress-desc">Progreso · mayor primero</option><option value="progress-asc">Progreso · menor primero</option><option value="last">Última llamada · reciente</option><option value="name">Nombre · A a Z</option></select></label>
      <button onClick={reset} className={iconButton} title="Limpiar filtros" aria-label="Limpiar filtros"><X size={16} /></button>
    </section>
    {from && to && from > to && <p role="alert" className="text-sm text-red-700">La fecha inicial del filtro debe ser anterior a la final.</p>}
    <div className="flex items-center justify-between"><p role="status" className="text-sm text-muted">{visible.length} de {clients.length} clientes</p><span className="text-xs text-muted">Meta: {SESSION_LIMIT} sesiones</span></div>
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="border-b border-border bg-surface-muted text-xs text-muted"><tr>{['Cliente',...(isAdmin ? ['Coach'] : []),'Progreso','Sesiones','Inicio','Fin','Última llamada','Estado'].map(h=><th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{visible.map(client=>{
          const p = sessionProgress(client.calls);
          return <tr key={client.id} className="align-top hover:bg-surface-muted/40">
            <td className="px-4 py-3"><Link prefetch={false} href={`${basePath}/clients/${client.id}`} className={`flex min-h-10 max-w-60 items-center gap-2 font-medium hover:underline ${p.excess ? 'text-red-700' : 'text-foreground'}`}>
              {p.excess > 0 && <TriangleAlert size={16} className="shrink-0" aria-label="Excede 12 sesiones" />}<span className="break-words">{client.name}</span></Link>{p.excess > 0 && <p className="text-xs text-red-700">{p.excess} {p.excess===1?'sesión':'sesiones'} sobre el límite</p>}</td>
            {isAdmin && <td className="max-w-44 px-4 py-5 text-muted">{client.coaches.join(', ') || 'Sin coach'}</td>}
            <td className="px-4 py-5"><div className="flex w-40 items-center gap-3"><div role="progressbar" aria-label={`Progreso de ${client.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-valuetext={`${p.sessions} de ${SESSION_LIMIT} sesiones`} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"><div className={`h-full ${p.excess?'bg-red-600':'bg-accent'}`} style={{width:`${p.percent}%`}} /></div><span className={`w-10 text-right font-semibold tabular-nums ${p.excess?'text-red-700':''}`}>{p.percent}%</span></div></td>
            <td className={`px-4 py-5 tabular-nums ${p.excess?'font-semibold text-red-700':'text-muted'}`}>{p.sessions} / {SESSION_LIMIT}</td>
            <td className="px-4 py-3 text-muted">{readOnly ? formatDate(client.startDate) : <RowEditor key={`${client.id}-start-${client.startDate}`} client={client} />}</td>
            <td className="whitespace-nowrap px-4 py-5 text-muted">{formatDate(progressEndDate(client.startDate))}</td>
            <td className="whitespace-nowrap px-4 py-5 text-muted">{formatDate(client.lastCall)}</td>
            <td className="px-4 py-3"><ClientStateSelector client={client} categories={categories} isAdmin={isAdmin} readOnly={readOnly} /></td>
          </tr>;
        })}</tbody>
      </table>
      {!visible.length && <p className="px-4 py-10 text-center text-sm text-muted">No hay clientes que coincidan con estos filtros.</p>}
    </div>
  </div>;
}
