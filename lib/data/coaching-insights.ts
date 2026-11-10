import 'server-only';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { loadInsightSource, readInsightBundle } from '@/lib/coaching-insight-store.mjs';
import type { CoachingBundle } from '@/lib/coaching-insight-types';

export async function authorizeCoachingClient(clientId: string) {
  const session=await requireRole(['admin','coach']);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId))throw new Error('denied');
  const [allowed]=await getSql()`select c.id from public.clients c where c.id=${clientId}::uuid and
    (${session.profile.role==='admin'} or exists(select 1 from public.coach_client_assignments a
      join public.coaches co on co.id=a.coach_id where a.client_id=c.id and co.profile_id=${session.userId}::uuid))`;
  if(!allowed)throw new Error('denied');
  return session;
}
export async function getCoachingInsights(clientId:string):Promise<CoachingBundle> {
  await authorizeCoachingClient(clientId);
  const sql=getSql();
  try {
    const source=await loadInsightSource(sql,clientId);
    const bundle=await readInsightBundle(sql,clientId,source.hash);
    return {...bundle,sourceHash:source.hash,summaryCount:source.sessions.length,totalCalls:source.totalCalls,available:true} as unknown as CoachingBundle;
  }catch(error) {
    // Existing client pages remain available before the additive migration lands.
    if((error as {code?:string}).code==='42P01')return {versions:[],topics:[],recommendations:[],sourceHash:'',summaryCount:0,totalCalls:0,available:false};
    throw error;
  }
}
