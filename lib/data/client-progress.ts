import 'server-only';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { getCoachByProfileId } from '@/lib/data/client-detail';
import type { ProgressClient, ProgressCategory, ProgressCoach } from '@/lib/client-progress';

export async function getStaffProgress(previewCoachId?: string) {
  const session = await requireRole(['admin', 'coach']);
  const coach = session.profile.role === 'coach' ? await getCoachByProfileId(session.userId) : null;
  const coachId = session.profile.role === 'coach' ? coach?.id : previewCoachId;
  if (session.profile.role === 'coach' && !coachId) throw new Error('Coach no asociado.');
  return { ...(await loadProgress(coachId)), isAdmin: session.profile.role === 'admin' && !previewCoachId };
}

/** Datos de Progreso sin comprobar sesión: solo para usarse después de verificar permisos (o en la revisión local). */
export async function loadProgress(coachId?: string | null) {
  const sql = getSql();
  const clients = await sql`
    with session_stats as materialized (
      select client_id, count(*)::int as calls, max(started_at)::text as last_call
      from public.client_sessions where client_id is not null group by client_id
    ), assignments as (
      select a.client_id,
        array_agg(coalesce(co.full_name,co.email) order by co.full_name,co.id) as coaches,
        array_agg(a.coach_id::text order by co.full_name,co.id) as coach_ids
      from public.coach_client_assignments a join public.coaches co on co.id=a.coach_id
      group by a.client_id
    ), primary_coach as (
      select a.client_id, a.coach_id::text as coach_id, coalesce(co.full_name,co.email) as name
      from public.coach_client_assignments a join public.coaches co on co.id=a.coach_id where a.is_primary
    ), also as (
      -- Secundarios: coaches que cobran por llamada y tuvieron al menos una llamada con el cliente. No se guardan aparte.
      select ca.client_id, array_agg(distinct coalesce(co.full_name,co.email) order by coalesce(co.full_name,co.email)) as names,
        array_agg(distinct co.id::text) as ids
      from public.calls ca join public.coaches co on co.id=ca.coach_id
      left join public.coach_client_assignments p on p.client_id=ca.client_id and p.is_primary
      where ca.client_id is not null and not co.is_support_coach and co.id is distinct from p.coach_id
      group by ca.client_id
    ), labels as (
      select client_id,array_agg(category_id::text order by category_id) as category_ids
      from public.client_progress_labels group by client_id
    )
    select c.id::text, coalesce(c.full_name,c.email,'Sin nombre') as name, c.email,
      c.start_date::text as "startDate", c.status as "operationalStatus",
      coalesce(labels.category_ids,'{}') as "categoryIds",
      coalesce(session_stats.calls,0) as calls, session_stats.last_call as "lastCall",
      coalesce(assignments.coaches,'{}') as coaches,
      coalesce(assignments.coach_ids,'{}') as "coachIds",
      c.entry_order as "entryOrder", c.end_date::text as "endDate",
      primary_coach.name as "primaryCoach", primary_coach.coach_id as "primaryCoachId",
      coalesce(also.names,'{}') as "alsoCoaches", coalesce(also.ids,'{}') as "alsoCoachIds"
    from public.clients c
    left join primary_coach on primary_coach.client_id=c.id
    left join also on also.client_id=c.id
    left join session_stats on session_stats.client_id=c.id
    left join assignments on assignments.client_id=c.id
    left join labels on labels.client_id=c.id
    where (${coachId ?? null}::uuid is null or exists (select 1 from public.coach_client_assignments a where a.client_id=c.id and a.coach_id=${coachId ?? null}::uuid))
    order by c.entry_order nulls last, c.full_name nulls last, c.email
  `;
  const categories = await sql`select id::text,label,active from public.client_progress_categories order by label`;
  const [{ today }] = await sql`select ((now() at time zone 'America/Bogota')::date)::text as today`;
  const coaches = await sql`select id::text, coalesce(full_name,email) as name, is_support_coach as "isSupport" from public.coaches where is_active order by coalesce(full_name,email)`;
  return { clients: clients as unknown as ProgressClient[], categories: categories as unknown as ProgressCategory[], coaches: coaches as unknown as ProgressCoach[], today: today as string };
}
