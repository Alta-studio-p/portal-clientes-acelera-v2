'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { RefreshCw, Check, Pencil, Sparkles, History, ArrowUpRight } from 'lucide-react';
import { TOPICS, TOPIC_STATES } from '@/lib/coaching-topics.mjs';
import type { CoachingBundle } from '@/lib/coaching-insight-types';
import { generateCoachingMap, reviewCoachingMap, type CoachingActionState } from '@/lib/actions/coaching-insights';
import { pillField } from '@/components/page-kit';
import { formatDateTime, formatDate } from '@/lib/format';

const initial:CoachingActionState={error:null,message:null};
const button='inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-muted disabled:opacity-50';
const colours:Record<string,string>={pendiente:'bg-surface-muted text-muted',en_trabajo:'bg-sky-100 text-sky-900',trabajado:'bg-emerald-100 text-emerald-900',seguimiento:'bg-amber-100 text-amber-900'};

function ReviewForm({clientId,kind,itemKey,state,note}:{clientId:string;kind:'topic'|'recommendation';itemKey:string;state?:string;note?:string}){
  const [result,action,pending]=useActionState(reviewCoachingMap,initial);
  return <details className="mt-2">
    <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs font-medium text-accent"><Pencil size={13} aria-hidden="true" />{kind==='topic'?'Revisar estado':'Revisar enfoque'}</summary>
    <form action={action} className="mt-2 max-w-lg space-y-2 pb-2">
      <input type="hidden" name="clientId" value={clientId}/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="key" value={itemKey}/>
      <label className="block text-xs text-muted">{kind==='topic'?'Estado confirmado':'Decisión'}
        <select name="state" required defaultValue={state??''} disabled={pending} className={`${pillField} mt-1 w-full`}>
          <option value="" disabled>Seleccionar</option>
          {kind==='topic'?Object.entries(TOPIC_STATES).map(([value,label])=><option key={value} value={value}>{label}</option>):<><option value="accepted">Aceptar</option><option value="edited">Editar enfoque</option><option value="dismissed">Descartar</option></>}
        </select>
      </label>
      <label className="block text-xs text-muted">{kind==='topic'?'Nota del coach':'Enfoque editado o nota'}
        <textarea name="note" defaultValue={note??''} maxLength={1000} disabled={pending} rows={2} className="mt-1 w-full rounded-md border border-border bg-surface p-3 text-sm text-foreground" />
      </label>
      <button disabled={pending} className={button}><Check size={14} aria-hidden="true" />{pending?'Guardando…':'Guardar'}</button>
      {result.error&&<p role="alert" className="text-sm text-red-700">{result.error}</p>}
      {result.message&&<p role="status" className="text-xs text-accent">{result.message}</p>}
    </form>
  </details>;
}

export function CoachingInsightsPanel({clientId,bundle,calls,basePath,readOnly=false}:{
  clientId:string;bundle:CoachingBundle;calls:{id:string;title:string;date:string|null}[];basePath:string;readOnly?:boolean;
}){
  const [generation,action,pending]=useActionState(generateCoachingMap,initial);
  const [selected,setSelected]=useState<string|null>(null);
  const current=bundle.versions.find(v=>v.source_hash===bundle.sourceHash)??bundle.versions[0];
  const version=bundle.versions.find(v=>v.id===selected)??current;
  const historic=Boolean(version&&version.id!==current?.id);
  const stale=Boolean(current&&current.source_hash!==bundle.sourceHash);
  const editable=!readOnly&&!historic;
  const analysis=version?.analysis;
  const sources=(refs:string[])=>refs.map(ref=>{
    const index=Number(ref.slice(1))-1;
    const id=version?.source_call_ids[index];
    const call=calls.find(c=>c.id===id);
    return call?<Link key={ref} prefetch={false} href={`${basePath}?section=calls&call=${encodeURIComponent(call.id)}`} title={call.title} className="inline-flex min-h-7 items-center gap-1 rounded px-1.5 text-xs text-accent underline decoration-accent/30 hover:decoration-accent">{formatDate(call.date)}<ArrowUpRight size={12} aria-hidden="true"/></Link>:<span key={ref} className="text-xs text-muted">Fuente no disponible</span>;
  });
  const factList=(items:{text:string;sources:string[]}[],empty:string)=>items.length?<ul className="space-y-3">{items.map((item,index)=><li key={index} className="text-sm leading-6"><p>{item.text}</p><div className="flex flex-wrap">{sources(item.sources)}</div></li>)}</ul>:<p className="text-sm text-muted">{empty}</p>;

  return <div className="space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles size={18} className="text-accent" aria-hidden="true"/>Mapa del proceso</h2>
        <p className="mt-1 text-xs text-muted">Síntesis IA · {bundle.summaryCount} de {bundle.totalCalls} llamadas con resumen completo{version?` · Actualizado ${formatDateTime(version.created_at)}`:''}</p>
      </div>
      {!readOnly&&bundle.available&&<form action={action}><input type="hidden" name="clientId" value={clientId}/><button disabled={pending||!bundle.summaryCount||Boolean(current&&!stale)} className={button}><RefreshCw size={15} aria-hidden="true" className={pending?'animate-spin':''}/>{pending?'Analizando…':current?'Actualizar mapa':'Generar mapa'}</button></form>}
    </div>
    {!bundle.available&&<p role="status" className="text-sm text-muted">El mapa todavía no está habilitado en esta base de datos.</p>}
    {generation.error&&<p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{generation.error}</p>}
    {generation.message&&<p role="status" className="text-sm text-accent">{generation.message}</p>}
    {stale&&<p role="status" className="border-y border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Hay llamadas nuevas o resúmenes modificados que aún no están incluidos en este mapa.</p>}
    {!analysis?<p className="py-6 text-sm text-muted">{bundle.summaryCount?'El análisis de este cliente está pendiente.':'Todavía no hay resúmenes completos para construir el mapa.'}</p>:<>
      {bundle.versions.length>1&&<label className="flex flex-wrap items-center gap-2 text-xs text-muted"><History size={15} aria-hidden="true"/>Versión del análisis<select className={`${pillField} max-w-full`} value={version.id} onChange={e=>setSelected(e.target.value)}>{bundle.versions.map(v=><option key={v.id} value={v.id}>{formatDateTime(v.created_at)}{v.id===current.id?' · Actual':''}</option>)}</select></label>}
      {historic&&<p className="text-sm text-muted">Versión histórica · Solo lectura</p>}
      {version.truncated&&<p className="text-xs text-muted">Algunos resúmenes se abreviaron para mantener el límite de consumo.</p>}
      <section className="grid gap-6 border-b border-border pb-6 lg:grid-cols-[1fr_2fr]">
        <div><h3 className="mb-2 text-sm font-semibold text-muted">Objetivo profesional</h3><p className="text-base leading-7">{analysis.objective.text||'Sin objetivo explícito en las llamadas.'}</p><div className="mt-1 flex flex-wrap">{sources(analysis.objective.sources)}</div></div>
        <div><h3 className="mb-2 text-sm font-semibold text-muted">Panorama actual</h3><p className="max-w-[72ch] text-sm leading-7">{analysis.overview.text||'Sin evidencia suficiente.'}</p><div className="mt-1 flex flex-wrap">{sources(analysis.overview.sources)}</div></div>
      </section>
      <section aria-labelledby="next-focus"><h3 id="next-focus" className="mb-3 text-base font-semibold">Enfoque sugerido para la próxima sesión</h3>
        <ol className="divide-y divide-border border-y border-border">{analysis.recommendations.map(rec=>{
          const review=!historic?bundle.recommendations.find(r=>r.recommendation_key===rec.key):undefined;
          return <li key={rec.key} className="py-4"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-muted">Sugerencia IA</span>{review&&<span className="rounded bg-accent-soft px-2 py-1 text-xs text-accent">{review.state==='accepted'?'Aceptada':review.state==='dismissed'?'Descartada':'Editada por coach'}</span>}</div>
            <p className={`mt-1 text-sm font-semibold ${review?.state==='dismissed'?'text-muted line-through':''}`}>{review?.state==='edited'?review.note:rec.action}</p>
            <p className="mt-1 max-w-[80ch] text-sm leading-6 text-muted">{rec.reason}</p><div className="flex flex-wrap">{sources(rec.sources)}</div>
            {review?.note&&review.state!=='edited'&&<p className="mt-2 text-sm">Nota del coach: {review.note}</p>}
            {editable&&<ReviewForm clientId={clientId} kind="recommendation" itemKey={rec.key} state={review?.state} note={review?.note}/>}
          </li>;
        })}</ol>
        {!analysis.recommendations.length&&<p className="text-sm text-muted">No hay evidencia suficiente para proponer un enfoque.</p>}
      </section>
      <section aria-labelledby="map-topics"><h3 id="map-topics" className="mb-3 text-base font-semibold">Áreas de trabajo</h3>
        <div className="divide-y divide-border border-y border-border">{TOPICS.map(([key,label])=>{
          const topic=analysis.topics.find(t=>t.key===key),review=!historic?bundle.topics.find(t=>t.topic===key):undefined;
          const state=review?.state??topic?.state??'pendiente';
          return <div key={key} className="grid gap-2 py-4 md:grid-cols-[180px_1fr_220px]">
            <h4 className="text-sm font-medium">{label}</h4><div><p className="text-sm leading-6 text-muted">{topic?.reason||'Sin trabajo documentado en las llamadas.'}</p><div className="flex flex-wrap">{sources(topic?.sources??[])}</div>{review?.note&&<p className="mt-2 text-sm">Nota del coach: {review.note}</p>}</div>
            <div><span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${colours[state]??colours.pendiente}`}>{TOPIC_STATES[state as keyof typeof TOPIC_STATES]}</span><p className="mt-1 text-xs text-muted">{review?'Confirmado por coach':'Propuesta IA'}</p>{editable&&<ReviewForm clientId={clientId} kind="topic" itemKey={key} state={state} note={review?.note}/>}</div>
          </div>;
        })}</div>
      </section>
      <section className="grid gap-8 md:grid-cols-3">
        <div><h3 className="mb-3 text-sm font-semibold">Avances documentados</h3>{factList(analysis.advances,'Sin avances explícitos documentados.')}</div>
        <div><h3 className="mb-3 text-sm font-semibold">Obstáculos mencionados</h3>{factList(analysis.blockers,'Sin obstáculos explícitos documentados.')}</div>
        <div><h3 className="mb-3 text-sm font-semibold">Acuerdos por revisar</h3>{factList(analysis.pending,'Sin acuerdos pendientes explícitos.')}</div>
      </section>
      <section><h3 className="mb-4 text-base font-semibold">Evolución llamada a llamada</h3><ol className="divide-y divide-border border-y border-border">{[...analysis.evolution].reverse().map(item=><li key={item.source} className="py-4"><div>{sources([item.source])}</div><p className="mt-1 max-w-[80ch] text-sm leading-6">{item.change}</p>{item.pending.length>0&&<p className="mt-2 max-w-[80ch] text-xs leading-6 text-muted">Acuerdos de esa sesión: {item.pending.join(' · ')}</p>}</li>)}</ol></section>
    </>}
  </div>;
}
