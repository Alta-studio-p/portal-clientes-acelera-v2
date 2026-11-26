import "server-only";
import { cache } from "react";
import { getSql } from "@/lib/db";
import type { masterclassCategories, masterclassStatuses } from "@/lib/masterclasses.mjs";

export type MasterclassCategory = keyof typeof masterclassCategories;

export type Masterclass = {
  id: string;
  title: string;
  description: string;
  /** Null solo para guías sin clase en vivo. */
  starts_at: string | null;
  previous_starts_at: string | null;
  /** Primera vez que se publicó como grabación/guía. */
  published_at?: string | null;
  duration_minutes: number | null;
  status: keyof typeof masterclassStatuses;
  live_url: string | null;
  drive_url: string | null;
  fathom_url?: string | null;
  cover_url?: string | null;
  resources?: unknown;
  category?: MasterclassCategory;
  source_call_id?: string | null;
};

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/**
 * Clientes solo ven grabaciones/guías publicadas y clases programadas o canceladas que no han
 * terminado; los enlaces se ocultan según estado. Admin ve todo.
 */
function select(admin: boolean, id: string | null) {
  const sql = getSql();
  return sql`
    select id::text, title, description, starts_at, previous_starts_at, published_at, duration_minutes, status,
      case when ${admin} or status = 'scheduled' then live_url end as live_url,
      case when ${admin} or status = 'recording' then drive_url end as drive_url,
      case when ${admin} or status = 'recording' then fathom_url end as fathom_url,
      case when ${admin} or status = 'recording' then resources else '[]'::jsonb end as resources,
      cover_url, category, source_call_id::text
    from public.masterclasses
    where (${id}::uuid is null or id = ${id}::uuid) and (${admin}
      or (status = 'recording' and coalesce(starts_at, published_at) <= now())
      or (status in ('scheduled', 'cancelled') and starts_at + duration_minutes * interval '1 minute' > now()))
    order by coalesce(published_at, starts_at) desc nulls last, id
  `;
}

export async function listMasterclasses(admin = false) {
  return (await select(admin, null)) as unknown as Masterclass[];
}

export const getMasterclass = cache(async (id: string, admin = false) => {
  if (!UUID.test(id)) return null;
  const [row] = await select(admin, id);
  return (row ?? null) as Masterclass | null;
});
