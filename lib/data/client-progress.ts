import 'server-only';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { getCoachByProfileId } from '@/lib/data/client-detail';
import type { ProgressClient, ProgressCategory } from '@/lib/client-progress';

export async function getStaffProgress(previewCoachId?: string) {
  const session = await requireRole(['admin', 'coach']);
  const coach = session.profile.role === 'coach' ? await getCoachByProfileId(session.userId) : null;
  const coachId = session.profile.role === 'coach' ? coach?.id : previewCoachId;
  if (session.profile.role === 'coach' && !coachId) throw new Error('Coach no asociado.');
  const sql = getSql();
  const clients = await sql`
    select c.id::text, coalesce(c.full_name,c.email,'Sin nombre') as name, c.email,
      c.start_date::text as "startDate", state.category_id::text as "categoryId",
      (select count(*)::int from public.client_sessions calls where calls.client_id=c.id) as calls,
      (select max(started_at)::text from public.client_sessions calls where calls.client_id=c.id) as "lastCall",
      coalesce((select array_agg(coalesce(co.full_name,co.email) order by co.full_name)
        from public.coach_client_assignments a join public.coaches co on co.id=a.coach_id where a.client_id=c.id),'{}') as coaches,
      coalesce((select array_agg(a.coach_id::text order by co.full_name)
        from public.coach_client_assignments a join public.coaches co on co.id=a.coach_id where a.client_id=c.id),'{}') as "coachIds"
    from public.clients c left join public.client_progress_states state on state.client_id=c.id
    where (${coachId ?? null}::uuid is null or exists (select 1 from public.coach_client_assignments a where a.client_id=c.id and a.coach_id=${coachId ?? null}::uuid))
    order by c.full_name nulls last,c.email
  `;
  const categories = await sql`select id::text,label,active from public.client_progress_categories order by label`;
  return { clients: clients as unknown as ProgressClient[], categories: categories as unknown as ProgressCategory[], isAdmin: session.profile.role === 'admin' && !previewCoachId };
}
