import 'server-only';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import type { Coach } from '@/lib/supabase/types';
import type { AttentionCall } from '@/lib/call-assignment';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requirePreviewCoach(id: string): Promise<Coach> {
  await requireRole(['admin']);
  if (!uuid.test(id)) notFound();
  const sql = getSql();
  const [coach] = await sql`select id::text, profile_id::text, full_name, email,
    fathom_source_key, calendar_source_key, is_active, created_at::text, updated_at::text
    from public.coaches where id=${id}::uuid`;
  if (!coach) notFound();
  return coach as unknown as Coach;
}

export async function getPreviewUnassignedCalls(coachId: string): Promise<AttentionCall[]> {
  await requirePreviewCoach(coachId);
  const sql = getSql();
  const calls = await sql`select c.id::text, c.client_id::text, c.coach_id::text,
    c.title, c.display_title, c.started_at::text, c.summary, c.recording_url, c.share_url,
    coalesce(co.full_name, co.email) as coach_name
    from public.calls c join public.coaches co on co.id=c.coach_id
    where c.coach_id=${coachId}::uuid and c.client_id is null
    order by c.started_at desc nulls last, c.id`;
  return calls as unknown as AttentionCall[];
}
