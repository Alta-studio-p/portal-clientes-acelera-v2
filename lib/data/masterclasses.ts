import "server-only";
import { getSql } from "@/lib/db";
import type { masterclassStatuses } from "@/lib/masterclasses.mjs";

export type Masterclass = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  previous_starts_at: string | null;
  duration_minutes: number | null;
  status: keyof typeof masterclassStatuses;
  live_url: string | null;
  drive_url: string | null;
};

export async function listMasterclasses(admin = false) {
  const sql = getSql();
  const rows = await sql`
    select id::text, title, description, starts_at, previous_starts_at, duration_minutes, status,
      case when ${admin} or status = 'scheduled' then live_url end as live_url,
      case when ${admin} or status = 'recording' then drive_url end as drive_url
    from public.masterclasses
    where ${admin} or (status = 'recording' and starts_at <= now()) or
      (status in ('scheduled', 'cancelled') and starts_at + duration_minutes * interval '1 minute' > now())
    order by starts_at desc, id
  `;
  return rows as unknown as Masterclass[];
}
