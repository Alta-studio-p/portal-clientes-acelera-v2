'use server';

import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { authorizeCoachingClient } from '@/lib/data/coaching-insights';
import { generateClientInsight } from '@/lib/coaching-insight-store.mjs';
import { TOPICS, TOPIC_STATES } from '@/lib/coaching-insights.mjs';

export type CoachingActionState={error:string|null;message:string|null};
function refresh(id:string){
  revalidatePath(`/coach/clients/${id}`);revalidatePath(`/admin/clients/${id}`);
  revalidatePath('/preview/coaches/[id]','layout');
}
export async function generateCoachingMap(_previous:CoachingActionState,form:FormData):Promise<CoachingActionState>{
  const id=String(form.get('clientId')??'');
  await authorizeCoachingClient(id);
  try{
    const result=await generateClientInsight(getSql(),id);
    if(result.status==='generated'||result.status==='cached'){refresh(id);return {error:null,message:result.status==='cached'?'El mapa ya está actualizado.':'Mapa actualizado.'};}
    const errors:Record<string,string>={missing_key:'Falta configurar la clave de OpenRouter en el servidor.',no_summaries:'Todavía no hay resúmenes completos para analizar.',daily_budget:'Se alcanzó el límite diario de IA. Conservamos el último mapa disponible.',recent_attempt:'Ya se solicitó este análisis recientemente. Espera unos minutos.',provider_cooldown:'OpenRouter está limitando las peticiones. El análisis está en pausa durante unos minutos.',obsolete:'Llegaron cambios durante el análisis. Vuelve a actualizar el mapa.'};
    return {error:errors[result.status]??'No se pudo generar el análisis. El mapa anterior se conserva.',message:null};
  }catch{return {error:'No se pudo generar el mapa. El análisis anterior no se modificó.',message:null};}
}

export async function reviewCoachingMap(_previous:CoachingActionState,form:FormData):Promise<CoachingActionState>{
  const id=String(form.get('clientId')??'');
  const session=await authorizeCoachingClient(id);
  const kind=String(form.get('kind')??''),key=String(form.get('key')??''),state=String(form.get('state')??'');
  const note=String(form.get('note')??'').trim();
  if(note.length>1000)return {error:'La nota admite hasta 1000 caracteres.',message:null};
  if(kind==='topic'?!TOPICS.some(([topic])=>topic===key)||!Object.hasOwn(TOPIC_STATES,state):kind!=='recommendation'||!/^[a-f0-9]{24}$/.test(key)||!['accepted','dismissed','edited'].includes(state))return {error:'Cambio inválido.',message:null};
  if(kind==='recommendation'&&state==='edited'&&!note)return {error:'Escribe el enfoque que quieres guardar.',message:null};
  try{
    await getSql().transaction(async tx=>{
      // Recheck assignment under the client lock immediately before any write.
      const [allowed]=await tx`select c.id from public.clients c where c.id=${id}::uuid and
        (${session.profile.role==='admin'} or exists(select 1 from public.coach_client_assignments a join public.coaches co on co.id=a.coach_id where a.client_id=c.id and co.profile_id=${session.userId}::uuid)) for update`;
      if(!allowed)throw new Error('denied');
      if(kind==='topic')await tx`insert into private.coaching_topic_reviews(client_id,topic,state,note,updated_by) values(${id}::uuid,${key},${state},${note},${session.userId}::uuid)
        on conflict(client_id,topic) do update set state=excluded.state,note=excluded.note,updated_by=excluded.updated_by,updated_at=now()`;
      else {
        const [exists]=await tx`select id from private.coaching_insights where client_id=${id}::uuid and exists(select 1 from jsonb_array_elements(analysis->'recommendations') r where r->>'key'=${key}) limit 1`;
        if(!exists)throw new Error('unknown_recommendation');
        await tx`insert into private.coaching_recommendation_reviews(client_id,recommendation_key,state,note,updated_by) values(${id}::uuid,${key},${state},${note},${session.userId}::uuid)
          on conflict(client_id,recommendation_key) do update set state=excluded.state,note=excluded.note,updated_by=excluded.updated_by,updated_at=now()`;
      }
    });
    refresh(id);return {error:null,message:'Guardado por el coach.'};
  }catch{return {error:'No se pudo guardar el cambio. Revisa tus permisos e inténtalo de nuevo.',message:null};}
}
