'use client';

import {useState} from 'react';
import {CalendarDays, Video, Search, ArrowUpRight, Clock3} from 'lucide-react';
import type {Masterclass} from '@/lib/data/masterclasses';
import {formatMasterclassDate,masterclassDriveUrl,masterclassLiveUrl,masterclassFathomUrl} from '@/lib/masterclasses.mjs';
import {MasterclassRecording} from '@/components/masterclass-recording';

const categories=[{id:'all',label:'Todas'},{id:'ai',label:'Inteligencia artificial'},{id:'caro',label:'Clases de Caro'}];
export function MasterclassesView({classes}:{classes:Masterclass[]}){
  const [category,setCategory]=useState('all');
  const [query,setQuery]=useState('');
  const schedule=classes.filter(c=>['scheduled','cancelled'].includes(c.status)).toReversed();
  const recordings=classes.filter(c=>c.status==='recording');
  const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  const visible=recordings.filter(c=>(category==='all'||(c.category??'ai')===category)&&normalize(c.title+' '+c.description).includes(normalize(query.trim())));
  const nextId=schedule.find(c=>c.status==='scheduled')?.id;
  return <div className="mx-auto max-w-6xl">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5"><h1 className="text-2xl font-semibold">Masterclases</h1><p className="text-sm text-muted">{recordings.length} grabaciones</p></header>
    <section aria-labelledby="schedule-title" className="mb-10 border-b border-border pb-6">
      <h2 id="schedule-title" className="mb-4 flex items-center gap-2 text-base font-semibold"><CalendarDays size={18} aria-hidden="true"/>Agenda</h2>
      {!schedule.length?<p className="text-sm text-muted">No hay próximas masterclases programadas.</p>:<ul className="divide-y divide-border">{schedule.map(item=>{
        const live=item.status==='scheduled'?masterclassLiveUrl(item.live_url??''):null;
        return <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="min-w-0 flex-1 basis-64"><p className="mb-1 text-xs font-medium text-accent">{item.status==='cancelled'?'Cancelada':item.id===nextId?'Próxima clase':'Programada'}{item.previous_starts_at?' · Reprogramada':''}</p><h3 className="break-words text-lg font-semibold">{item.title}</h3><p className="mt-1 text-sm text-muted">{formatMasterclassDate(item.starts_at)} · Colombia</p>{item.previous_starts_at&&<p className="mt-1 text-xs text-muted">Antes: {formatMasterclassDate(item.previous_starts_at)}</p>}{item.description&&<p className="mt-2 max-w-[70ch] text-sm leading-6 text-muted">{item.description}</p>}</div>
          {live&&<a href={live} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"><Video size={16} aria-hidden="true"/>Unirme en vivo</a>}
        </li>;
      })}</ul>}
    </section>
    <section aria-labelledby="library-title"><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 id="library-title" className="text-lg font-semibold">Biblioteca de clases</h2><label className="relative w-full sm:w-80"><span className="sr-only">Buscar masterclases</span><Search size={16} aria-hidden="true" className="absolute left-3 top-3.5 text-muted"/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar clase o tema" className="min-h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-base sm:text-sm focus-visible:outline-2 focus-visible:outline-accent"/></label></div>
      <div role="group" aria-label="Categoría de masterclase" className="mb-6 flex flex-wrap gap-2">{categories.map(item=><button key={item.id} type="button" aria-pressed={category===item.id} onClick={()=>setCategory(item.id)} className={'inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent '+(category===item.id?'bg-accent text-white':'border border-border bg-surface text-muted hover:text-foreground')}>{item.label}<span className="tabular-nums opacity-80">{recordings.filter(c=>item.id==='all'||(c.category??'ai')===item.id).length}</span></button>)}</div>
      {!visible.length?<p role="status" className="border-y border-border py-10 text-sm text-muted">{query?'No hay clases que coincidan con tu búsqueda.':'Todavía no hay grabaciones publicadas en esta categoría.'}</p>:<ul className="grid gap-5 md:grid-cols-2">{visible.map(item=>{
        const drive=masterclassDriveUrl(item.drive_url??''),fathom=masterclassFathomUrl(item.fathom_url??'');
        return <li key={item.id} className="min-w-0"><article className="flex h-full min-w-0 flex-wrap content-start gap-4 rounded-lg border border-border bg-surface p-5">
          <div className="flex w-full items-center justify-between gap-3"><span className={'rounded px-2 py-1 text-xs font-medium '+(item.category==='caro'?'bg-rose-50 text-rose-800':'bg-accent-soft text-accent')}>{item.category==='caro'?'Clases de Caro':'Inteligencia artificial'}</span><Video size={19} aria-hidden="true" className="text-muted"/></div>
          <div className="w-full min-w-0"><h3 className="break-words text-lg font-semibold leading-7">{item.title}</h3><p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted"><time dateTime={item.starts_at}>{formatMasterclassDate(item.starts_at,false)}</time>{item.duration_minutes&&<span className="inline-flex items-center gap-1"><Clock3 size={13} aria-hidden="true"/>{item.duration_minutes} min</span>}</p>{item.description&&<p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{item.description}</p>}</div>
          {drive?<MasterclassRecording title={item.title} driveUrl={drive}/>:fathom?<a href={fathom} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-accent hover:bg-accent-soft">Ver en Fathom<ArrowUpRight size={16} aria-hidden="true"/></a>:<span className="text-sm text-muted">Grabación no disponible</span>}
        </article></li>;
      })}</ul>}
    </section>
  </div>;
}
