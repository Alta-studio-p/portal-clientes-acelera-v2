import Link from 'next/link';
import type { ComponentProps } from 'react';
import { Route, Phone } from 'lucide-react';
import { ClientDetailView } from '@/components/client-detail-view';
import { ClientHeader } from '@/components/client-detail/client-header';
import { CoachingInsightsPanel } from '@/components/coaching-insights-panel';
import { getCoachingInsights } from '@/lib/data/coaching-insights';
import { displayCallTitle } from '@/lib/call-title';

export async function StaffClientWorkspace(props:ComponentProps<typeof ClientDetailView>&{section?:string;readOnly?:boolean}){
  const callsView=props.section==='calls'||Boolean(props.selectedCallId);
  const navigation=<nav aria-label="Ficha del cliente" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
    {[{href:props.callHrefBase,label:'Mapa del proceso',icon:Route,active:!callsView},{href:`${props.callHrefBase}?section=calls`,label:'Llamadas y resúmenes',icon:Phone,active:callsView}].map(item=><Link key={item.label} prefetch={false} href={item.href} aria-current={item.active?'page':undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium ${item.active?'border-accent text-accent':'border-transparent text-muted hover:text-foreground'}`}><item.icon size={16} aria-hidden="true"/>{item.label}</Link>)}
  </nav>;
  if(callsView)return <ClientDetailView {...props} navigation={navigation}/>;
  const bundle=await getCoachingInsights(props.client.id);
  return <div><ClientHeader client={props.client} backHref={props.backHref} headerActions={props.headerActions}/>{navigation}
    {props.showNotes&&props.client.notes&&<p className="mb-6 rounded-md bg-surface-muted px-3 py-2 text-xs text-muted">Nota interna: {props.client.notes}</p>}
    <CoachingInsightsPanel clientId={props.client.id} bundle={bundle} basePath={props.callHrefBase} readOnly={props.readOnly}
      calls={props.client.calls.map(call=>({id:call.id,title:displayCallTitle(call),date:call.started_at}))}/>
  </div>;
}
