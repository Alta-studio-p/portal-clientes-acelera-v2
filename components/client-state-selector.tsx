'use client';

import { useActionState, useId, useOptimistic, useState, useTransition, type CSSProperties } from 'react';
import { Archive, Check, MoreHorizontal, Plus, RotateCcw, Save, Search, X } from 'lucide-react';
import { editProgressLabel, manageProgressCategory } from '@/lib/actions/client-progress';
import type { ProgressCategory, ProgressClient } from '@/lib/client-progress';
import { StatusBadge } from '@/components/status-badge';

const tag = 'inline-flex min-w-0 max-w-full items-center rounded px-2 py-1 text-xs font-medium leading-4';
const icon = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50';

function CategoryOptions({ category }: { category: ProgressCategory }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(manageProgressCategory, {error:null,success:false});
  return <>
    <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={`Opciones de ${category.label}`} title={`Opciones de ${category.label}`} className={icon}><MoreHorizontal size={16} /></button>
    {open && <form action={action} className="col-span-2 space-y-2 border-t border-border p-2">
      <input type="hidden" name="id" value={category.id} />
      <label className="block text-xs text-muted">Nombre del estado<input name="label" required maxLength={60} defaultValue={category.label} disabled={pending} className="mt-1 min-h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:ring-2 focus:ring-accent/20" /></label>
      <div className="flex items-center gap-2">
        <button name="operation" value="rename" disabled={pending} title="Guardar nombre" aria-label={`Guardar nombre de ${category.label}`} className={icon}><Save size={16} /></button>
        <button name="operation" value={category.active?'archive':'restore'} formNoValidate disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded px-2 text-xs text-muted hover:bg-surface-muted">{category.active?<Archive size={14}/>:<RotateCcw size={14}/>}{category.active?'Retirar estado':'Restaurar estado'}</button>
      </div>
      {state.error && <p role="alert" className="text-xs text-red-700">{state.error}</p>}
      {state.success && <p role="status" className="text-xs text-accent">Guardado</p>}
    </form>}
  </>;
}

export function ClientStateSelector({ client, categories, isAdmin, readOnly = false }: {
  client: ProgressClient; categories: ProgressCategory[]; isAdmin: boolean; readOnly?: boolean;
}) {
  const popoverId = useId();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [position, setPosition] = useState<CSSProperties>({});
  const [selected, updateSelected] = useOptimistic(client.categoryIds, (ids: string[], change: {id:string; checked:boolean}) =>
    change.checked ? [...new Set([...ids,change.id])] : ids.filter(id=>id!==change.id));
  const normalized = query.trim().replace(/\s+/g,' ');
  const options = categories.filter(c=>(c.active || selected.includes(c.id) || (isAdmin && normalized.length > 0)) && c.label.toLocaleLowerCase('es').includes(normalized.toLocaleLowerCase('es')));
  const canCreate = normalized.length > 0 && normalized.length <= 60 && !categories.some(c=>c.label.toLocaleLowerCase('es')===normalized.toLocaleLowerCase('es'));
  const chips = <>
    <StatusBadge status={client.operationalStatus} />
    {categories.filter(c=>selected.includes(c.id)).map(c=><span key={c.id} className={`${tag} bg-accent-soft text-accent`}><span className="min-w-0 break-words">{c.label}{!c.active?' (retirado)':''}</span></span>)}
  </>;
  function assign(id: string, checked: boolean) {
    setError(null);
    startTransition(async()=>{
      updateSelected({id,checked});
      const result = await editProgressLabel(client.id,checked?'add':'remove',id);
      if (result.error) setError(result.error);
    });
  }
  function create() {
    setError(null);
    startTransition(async()=>{
      const result = await editProgressLabel(client.id,'create',normalized);
      if (result.error) setError(result.error);
      else setQuery('');
    });
  }
  if (readOnly) return <div className="flex w-56 flex-wrap gap-1 py-1">{chips}</div>;
  return <>
    <button type="button" popoverTarget={popoverId} aria-label={`Estados de ${client.name}`} title="Seleccionar o crear estados" className="flex min-h-10 w-56 flex-wrap items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent"
      onClick={event=>{
        const rect=event.currentTarget.getBoundingClientRect();
        const width=Math.min(336,window.innerWidth-16);
        const below=window.innerHeight-rect.bottom;
        const height=Math.min(440,Math.max(180,(below>=240?below:rect.top)-16));
        setPosition({position:'fixed',inset:'auto',left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:below>=240?rect.bottom+8:Math.max(8,rect.top-height-8),width,maxHeight:height});
      }}>{chips}<Plus size={14} className="ml-1 shrink-0 text-muted" aria-hidden="true" /></button>
    <div id={popoverId} popover="auto" role="dialog" aria-label={`Seleccionar estados de ${client.name}`} style={position}
      className="m-0 overflow-y-auto rounded-lg border border-border bg-surface p-2 text-foreground shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2 px-1"><h2 className="text-sm font-medium">Estados</h2><button type="button" popoverTarget={popoverId} popoverTargetAction="hide" className={icon} aria-label="Cerrar estados" title="Cerrar"><X size={16}/></button></div>
      <div className="relative mb-2"><Search size={15} className="absolute left-3 top-3 text-muted"/><input aria-label={`Buscar o crear estado para ${client.name}`} type="search" value={query} onChange={e=>setQuery(e.target.value)} maxLength={60} placeholder="Buscar o crear estado…" className="min-h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-accent/20" /></div>
      <div className="space-y-1" aria-busy={pending}>
        {options.map(c=><div key={c.id} className="grid grid-cols-[1fr_auto] items-center rounded-md hover:bg-surface-muted">
          <label className="flex min-h-10 min-w-0 cursor-pointer items-center gap-2 px-2 py-1">
            <input type="checkbox" checked={selected.includes(c.id)} disabled={pending || (!c.active&&!selected.includes(c.id))} onChange={e=>assign(c.id,e.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
            <span className={`${tag} bg-accent-soft text-accent`}><span className="min-w-0 break-words">{c.label}{!c.active?' (retirado)':''}</span></span>
          </label>
          {isAdmin && <CategoryOptions category={c} />}
        </div>)}
      </div>
      {canCreate && <button type="button" onClick={create} disabled={pending} className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-accent hover:bg-accent-soft disabled:opacity-50"><Plus size={16} className="shrink-0"/><span className="min-w-0 break-words">Crear “{normalized}”</span></button>}
      {!options.length && !canCreate && <p className="px-2 py-3 text-sm text-muted">No hay estados disponibles.</p>}
      {pending && <p role="status" className="mt-2 px-2 text-xs text-muted">Guardando…</p>}
      {error && <p role="alert" className="mt-2 px-2 text-xs text-red-700">{error}</p>}
      {!pending && selected.length>0 && <p className="mt-2 flex items-center gap-1 px-2 text-xs text-muted"><Check size={12}/>{selected.length} etiqueta{selected.length===1?'':'s'}</p>}
    </div>
  </>;
}
