'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Archive, Check, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, RotateCcw, Search, UserRoundPlus, X } from 'lucide-react';
import { assignClientToCall, changeCallDisposition } from '@/app/call-assignment-actions';
import type { AssignmentClient, AttentionCall } from '@/lib/call-assignment';
import { formatDate } from '@/lib/format';
import { displayCallTitle } from '@/lib/call-title';
import { publicRecordingUrl } from '@/lib/recording-link';
import { MarkdownLite } from '@/components/markdown-lite';

const control = 'min-h-11 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50';
const reasons:Record<string,string>={no_show:'No-show / no asistió',internal:'Llamada interna',unrelated:'Ajena al programa'};

function DispositionControl({call,onReviewed}:{call:AttentionCall;onReviewed:(message:string)=>void}) {
  const [editing,setEditing]=useState(false);
  const discarded=Boolean(call.discarded_at);
  const [state,action,pending]=useActionState(async(previous:{error:string|null;success:boolean},form:FormData)=>{
    const result=await changeCallDisposition(previous,form);
    if(result.success)onReviewed(discarded?'Llamada restaurada en pendientes.':'Llamada descartada. Puedes restaurarla desde Descartadas.');
    return result;
  },{error:null,success:false});
  if(!editing&&!discarded)return <button type="button" onClick={()=>setEditing(true)} className={`${control} mt-2 inline-flex items-center justify-center gap-2 text-muted hover:border-accent hover:text-accent`}><Archive size={16} aria-hidden="true"/>Descartar</button>;
  return <form action={action} className="mt-3 space-y-3 border-t border-border pt-3">
    <input type="hidden" name="callId" value={call.id}/><input type="hidden" name="operation" value={discarded?'restore':'discard'}/>
    {!discarded&&<label className="block text-xs font-medium text-muted">Motivo
      <select name="reason" required autoFocus disabled={pending} defaultValue="" className={`${control} mt-1 w-full`}><option value="" disabled>Seleccionar motivo</option>{Object.entries(reasons).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
    </label>}
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}
    <div className="flex items-center gap-2"><button disabled={pending} className={`${control} inline-flex flex-1 items-center justify-center gap-2 hover:border-accent hover:text-accent`}>{pending?<LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>:discarded?<RotateCcw size={16} aria-hidden="true"/>:<Archive size={16} aria-hidden="true"/>}{pending?'Guardando…':discarded?'Restaurar llamada':'Descartar llamada'}</button>
      {!discarded&&<button type="button" disabled={pending} onClick={()=>setEditing(false)} aria-label="Cancelar descarte" title="Cancelar" className={`${control} inline-flex w-11 items-center justify-center px-0`}><X size={18} aria-hidden="true"/></button>}
    </div>
  </form>;
}

function AssignmentCard({ call, clients, role, onAssigned, onReviewed, readOnly = false }: { call: AttentionCall; clients: AssignmentClient[]; role: 'admin' | 'coach'; onAssigned: () => void; onReviewed:(message:string)=>void; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (previous: { error: string | null; success: boolean }, form: FormData) => {
    const result = await assignClientToCall(previous, form);
    if (result.success) onAssigned();
    return result;
  }, { error: null, success: false });
  const recording = publicRecordingUrl(call);
  return <article className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4">
    <h3 className="break-words text-sm font-semibold text-foreground">{displayCallTitle(call)}</h3>
    <p className="mt-1 text-xs text-muted">{formatDate(call.started_at)}{call.coach_name ? ` · ${call.coach_name}` : ''}</p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
      {call.discarded_at?<span>{reasons[call.discard_reason??'']??'Descartada'}</span>:!call.client_id&&<span>Sin cliente</span>}
      {!call.summary && <span>Sin resumen</span>}
    </div>
    {call.classification&&<div className="mt-3 border-t border-border pt-3 text-xs text-muted"><p className="font-medium text-accent">{({no_show:'Posible no-show',caro_class:'Clase de Caro detectada',internal:'Posible llamada interna',client_session:'Sesión individual',uncertain:'Requiere revisión'} as Record<string,string>)[call.classification]} · IA</p><p className="mt-1 leading-5">{call.classification_reason}</p>{role==='admin'&&call.class_draft_id&&<Link className="mt-2 inline-flex min-h-9 items-center gap-1 text-accent underline" href={`/admin/masterclasses?edit=${call.class_draft_id}`}>Revisar clase detectada</Link>}</div>}
    {call.summary && <details className="mt-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 text-accent focus-visible:outline-2 focus-visible:outline-accent">Ver resumen</summary>
      <div className="mt-2 max-h-72 overflow-auto break-words border-t border-border pt-3"><MarkdownLite text={call.summary} /></div>
    </details>}
    {!readOnly && !call.discarded_at && (state.success ? <p role="status" className="mt-4 flex items-center gap-2 text-sm text-accent"><Check size={16} />Cliente asignado</p> : call.client_id ?
      <Link className={`${control} mt-4 inline-flex items-center justify-center`} href={`/${role}/clients/${call.client_id}?call=${call.id}`}>Ver llamada</Link> : editing ?
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="callId" value={call.id} />
        <label className="block text-xs font-medium text-muted" htmlFor={`client-${call.id}`}>Cliente</label>
        <select autoFocus required disabled={pending} id={`client-${call.id}`} name="clientId" defaultValue="" className={`${control} w-full min-w-0`}>
          <option value="" disabled>Seleccionar cliente</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.name}{client.email ? ` (${client.email})` : ''}</option>)}
        </select>
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        <div className="flex items-center gap-2">
          <button disabled={pending} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">{pending ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}{pending ? 'Guardando...' : 'Asignar'}</button>
          <button type="button" disabled={pending} onClick={() => setEditing(false)} aria-label="Cancelar asignación" title="Cancelar" className={`${control} inline-flex w-11 items-center justify-center px-0`}><X size={18} /></button>
        </div>
      </form> : <button onClick={() => setEditing(true)} disabled={!clients.length} className={`${control} mt-4 inline-flex items-center justify-center gap-2 hover:border-accent hover:text-accent`}><UserRoundPlus size={16} />Asignar cliente</button>)}
    {!readOnly&&<DispositionControl call={call} onReviewed={onReviewed}/>}
    {!readOnly && !call.discarded_at && !call.client_id && !clients.length && <p className="mt-2 text-xs text-muted">No hay clientes disponibles. Contacta al administrador.</p>}
    {recording && <a href={recording} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-accent hover:underline"><ExternalLink size={16} />Ver grabación</a>}
  </article>;
}

export function CallAssignmentQueue({ calls, discardedCalls=[], clients, role, readOnly = false }: { calls: AttentionCall[]; discardedCalls?:AttentionCall[]; clients: AssignmentClient[]; role: 'admin' | 'coach'; readOnly?: boolean }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const [view,setView]=useState<'pending'|'discarded'>('pending');
  const visible=view==='pending'?calls:discardedCalls;
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = visible.filter(call => normalize(`${displayCallTitle(call)} ${call.coach_name ?? ''} ${formatDate(call.started_at)}`).includes(normalize(query.trim())));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages - 1);
  return <section aria-label="Revisión de llamadas" className="mt-8">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-foreground">{view==='discarded'?'Llamadas descartadas':role === 'admin' ? 'Llamadas que requieren atención' : 'Mis llamadas por revisar'} <span className="ml-1 font-normal text-muted">({visible.length})</span></h2>
      <label className="relative block w-full sm:w-72"><span className="sr-only">Buscar llamadas</span><Search className="pointer-events-none absolute left-3 top-3.5 text-muted" size={16} /><input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Buscar por título, coach o fecha" className={`${control} w-full pl-9`} /></label>
    </div>
    <div role="group" aria-label="Estado de revisión" className="mb-4 inline-flex rounded-md border border-border p-1">{[{key:'pending',label:'Pendientes',count:calls.length},{key:'discarded',label:'Descartadas',count:discardedCalls.length}].map(item=><button key={item.key} type="button" aria-pressed={view===item.key} onClick={()=>{setView(item.key as 'pending'|'discarded');setPage(0);}} className={`inline-flex min-h-10 items-center gap-2 rounded px-3 text-sm font-medium ${view===item.key?'bg-accent-soft text-accent':'text-muted hover:bg-surface-muted'}`}>{item.label}<span className="tabular-nums">{item.count}</span></button>)}</div>
    <p role="status" aria-live="polite" className="mb-3 text-sm text-accent">{notice}</p>
    {!filtered.length ? <p role="status" className="py-6 text-sm text-muted">{visible.length ? 'No hay llamadas para esta búsqueda.' : view==='discarded'?'No hay llamadas descartadas.':'No hay llamadas pendientes.'}</p> : <>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.slice(current * 12, current * 12 + 12).map(call => <AssignmentCard key={call.id} call={call} clients={clients} role={role} readOnly={readOnly} onAssigned={() => setNotice('Cliente asignado correctamente.')} onReviewed={setNotice} />)}</div>
      <div className="mt-4 flex items-center justify-end gap-3 text-sm text-muted">
        <span aria-live="polite">{current * 12 + 1}-{Math.min((current + 1) * 12, filtered.length)} de {filtered.length}</span>
        <button type="button" title="Página anterior" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)} className={`${control} inline-flex w-11 items-center justify-center px-0`}><ChevronLeft size={18} /></button>
        <button type="button" title="Página siguiente" aria-label="Página siguiente" disabled={current === pages - 1} onClick={() => setPage(current + 1)} className={`${control} inline-flex w-11 items-center justify-center px-0`}><ChevronRight size={18} /></button>
      </div>
    </>}
  </section>;
}
