import "server-only";

import { getSql } from "@/lib/db";
import type { ClientStatus } from "@/lib/supabase/types";

export interface CoachClientRow {
  id: string;
  full_name: string | null;
  email: string;
  status: ClientStatus;
  start_date: string | null;
  end_date: string | null;
  is_primary: boolean;
  call_count: number;
  last_call_at: string | null;
}

export async function getClientsForCoach(coachId: string): Promise<CoachClientRow[]> {
  const sql = getSql();
  const rows = await sql`
    select
      c.id::text,
      c.full_name,
      c.email,
      c.status,
      c.start_date::text,
      c.end_date::text,
      a.is_primary,
      count(calls.id)::int as call_count,
      max(calls.started_at)::text as last_call_at
    from public.coach_client_assignments a
    join public.clients c on c.id = a.client_id
    left join public.calls calls on calls.client_id = c.id
    where a.coach_id = ${coachId}::uuid
    group by c.id, a.is_primary
    order by coalesce(c.full_name, c.email)
  `;

  return rows as unknown as CoachClientRow[];
}
