import 'server-only';
import { requireRole } from '@/lib/auth';
import { getCoachByProfileId } from '@/lib/data/client-detail';
import { getSql } from '@/lib/db';
import { displayCallTitle } from '@/lib/call-title';
import { CALL_HOURLY_RATE, monthBounds, type FeeRow } from '@/lib/coach-fees';

export async function getCoachFees(coachId: string, month: string): Promise<FeeRow[]> {
  const { userId, profile } = await requireRole(['admin', 'coach']);
  if (profile.role === 'coach') {
    const coach = await getCoachByProfileId(userId);
    if (!coach || coach.id !== coachId) throw new Error('No tienes acceso a estos honorarios.');
  }
  const sql = getSql();
  const { from, to } = monthBounds(month);
  const rows = await sql`
    with entries as (
      select f.id::text, c.id::text as call_id, c.coach_id::text,
        (case when f.id is null then c.client_id else f.client_id end)::text as client_id,
        coalesce(f.service_date, (c.started_at at time zone 'America/Bogota')::date)::text as service_date,
        f.topic, c.title, c.display_title, c.summary,
        coalesce(f.hours, 1)::float8 as hours,
        coalesce(f.amount, coalesce(f.hours, 1) * ${CALL_HOURLY_RATE})::float8 as amount,
        f.payment_type, f.paid_on::text,
        coalesce(nullif(trim(c.recording_url), ''), nullif(trim(c.share_url), '')) as recording_url
      from public.calls c
      left join public.coach_fees f on f.call_id = c.id
      where c.coach_id = ${coachId}::uuid and c.started_at is not null
      union all
      select f.id::text, null, f.coach_id::text, f.client_id::text, f.service_date::text,
        f.topic, null, null, null, f.hours::float8, f.amount::float8,
        f.payment_type, f.paid_on::text, null::text
      from public.coach_fees f
      where f.coach_id = ${coachId}::uuid and f.call_id is null
    )
    select e.*, coalesce(cl.full_name, cl.email, 'Sin cliente vinculado') as client_name
    from entries e
    left join public.clients cl on cl.id = e.client_id::uuid
    where e.service_date::date >= ${from}::date and e.service_date::date < ${to}::date
    order by e.service_date desc, e.call_id nulls last, e.id
  `;
  return rows.map(row => ({
    id: row.id as string | null,
    call_id: row.call_id as string | null,
    coach_id: row.coach_id as string,
    client_id: row.client_id as string | null,
    client_name: row.client_name as string,
    service_date: row.service_date as string,
    topic: (row.topic as string) || displayCallTitle(row as { title: string | null; display_title: string | null; summary: string | null }),
    hours: row.hours as number | null,
    amount: row.amount as number | null,
    payment_type: row.payment_type as string | null,
    paid_on: row.paid_on as string | null,
    recording_url: row.recording_url as string | null,
  }));
}
