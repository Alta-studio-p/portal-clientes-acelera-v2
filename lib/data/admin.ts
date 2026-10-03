import "server-only";

import { getSql } from "@/lib/db";
import type { CalendarEvent, Call, Client, Coach, ClientStatus } from "@/lib/supabase/types";

export interface AdminCounts {
  clients: number;
  coaches: number;
  calls: number;
  callsWithSummary: number;
  clientsWithContext: number;
}

export async function getAdminCounts(): Promise<AdminCounts> {
  const sql = getSql();
  const [counts] = await sql`
    select
      (select count(*)::int from public.clients) as clients,
      (select count(*)::int from public.coaches) as coaches,
      (select count(*)::int from public.calls) as calls,
      (select count(*)::int from public.calls where summary is not null) as "callsWithSummary",
      (select count(*)::int from public.clients where context_summary is not null) as "clientsWithContext"
  `;
  return counts as unknown as AdminCounts;
}

export interface ClientListRow extends Client {
  coach_names: string[];
  call_count: number;
  last_call_at: string | null;
  calls: { id: string; started_at: string | null }[];
}

export async function getClientsList(filters: {
  coachId?: string;
  status?: ClientStatus;
  search?: string;
}): Promise<ClientListRow[]> {
  const sql = getSql();
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`c.status = $${values.length}`);
  }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(c.full_name ilike $${values.length} or c.email ilike $${values.length})`);
  }
  if (filters.coachId) {
    values.push(filters.coachId);
    conditions.push(`exists (
      select 1 from public.coach_client_assignments filter_assignment
      where filter_assignment.client_id = c.id and filter_assignment.coach_id = $${values.length}::uuid
    )`);
  }

  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const rows = await sql.query(
    `select
      c.id::text, c.profile_id::text, c.email, c.full_name, c.status,
      c.drive_folder_url, c.drive_folder_id, c.first_call_id::text, c.context_summary,
      c.context_source_call_id::text, c.context_generated_at::text, c.notes,
      c.desired_salary_range, c.start_date::text, c.end_date::text,
      coalesce(assignments.coach_names, '{}') as coach_names,
      coalesce(client_calls.call_count, 0)::int as call_count,
      client_calls.last_call_at,
      coalesce(client_calls.calls, '[]'::jsonb) as calls
    from public.clients c
    left join lateral (
      select array_agg(coalesce(coach.full_name, coach.email) order by coalesce(coach.full_name, coach.email)) as coach_names
      from public.coach_client_assignments assignment
      join public.coaches coach on coach.id = assignment.coach_id
      where assignment.client_id = c.id
    ) assignments on true
    left join lateral (
      select
        count(*)::int as call_count,
        max(call.started_at)::text as last_call_at,
        jsonb_agg(jsonb_build_object('id', call.id::text, 'started_at', call.started_at::text) order by call.started_at) as calls
      from public.calls call
      where call.client_id = c.id
    ) client_calls on true
    ${where}
    order by c.start_date asc nulls last, c.full_name nulls last, c.email`,
    values
  );

  return rows as unknown as ClientListRow[];
}

export interface CoachWithClients extends Coach {
  clients: {
    id: string;
    full_name: string | null;
    email: string;
    status: ClientStatus;
    end_date: string | null;
    is_primary: boolean;
  }[];
}

export async function getCoachesWithClients(): Promise<CoachWithClients[]> {
  const sql = getSql();
  const rows = await sql`
    select
      coach.id::text, coach.profile_id::text, coach.email, coach.full_name,
      coach.fathom_source_key, coach.calendar_source_key, coach.is_active,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', client.id::text,
            'full_name', client.full_name,
            'email', client.email,
            'status', client.status,
            'end_date', client.end_date::text,
            'is_primary', assignment.is_primary
          ) order by coalesce(client.full_name, client.email)
        ) filter (where client.id is not null),
        '[]'::jsonb
      ) as clients
    from public.coaches coach
    left join public.coach_client_assignments assignment on assignment.coach_id = coach.id
    left join public.clients client on client.id = assignment.client_id
    group by coach.id
    order by coach.full_name nulls last, coach.email
  `;
  return rows as unknown as CoachWithClients[];
}

export async function getCallsNeedingAttention(): Promise<Call[]> {
  const sql = getSql();
  const rows = await sql`
    select
      id::text, client_id::text, coach_id::text, source, fathom_call_id, title, display_title,
      started_at::text, duration_seconds, summary, next_steps, recording_url, share_url,
      calendar_event_id::text, raw_metadata
    from public.calls
    where summary is null or client_id is null
    order by started_at desc nulls last
    limit 50
  `;
  return rows as unknown as Call[];
}

export interface AdminCalendarEvent extends CalendarEvent {
  coach: Pick<Coach, "id" | "full_name" | "email"> | null;
  client: Pick<Client, "id" | "full_name" | "email" | "status"> | null;
  matchedCall: Pick<
    Call,
    "id" | "client_id" | "coach_id" | "title" | "display_title" | "started_at" | "summary" | "recording_url" | "share_url" | "calendar_event_id"
  > | null;
}

export interface AdminUnscheduledCall
  extends Pick<
    Call,
    "id" | "client_id" | "coach_id" | "title" | "display_title" | "started_at" | "summary" | "recording_url" | "share_url" | "calendar_event_id"
  > {
  coach: Pick<Coach, "id" | "full_name" | "email"> | null;
  client: Pick<Client, "id" | "full_name" | "email" | "status"> | null;
}

export interface AdminCalendarDashboard {
  events: AdminCalendarEvent[];
  unscheduledCalls: AdminUnscheduledCall[];
  coaches: Pick<Coach, "id" | "full_name" | "email">[];
}

export async function getAdminCalendarDashboard({
  from,
  to,
  coachId,
}: {
  from: string;
  to: string;
  coachId?: string;
}): Promise<AdminCalendarDashboard> {
  const sql = getSql();
  const coachFilter = coachId ? "and source.coach_id = $3::uuid" : "";
  const params = coachId ? [from, to, coachId] : [from, to];

  const [coaches, eventRows, callRows] = await Promise.all([
    sql`
      select id::text, full_name, email
      from public.coaches
      where is_active = true
      order by full_name nulls last, email
    `,
    sql.query(
      `select
        source.id::text, source.coach_id::text, source.client_id::text, source.google_event_id,
        source.google_calendar_id, source.title, source.description, source.starts_at::text,
        source.ends_at::text, source.attendee_emails, source.status, source.matched_call_id::text,
        source.ignored_reason, source.raw_metadata,
        case when coach.id is null then null else jsonb_build_object(
          'id', coach.id::text, 'full_name', coach.full_name, 'email', coach.email
        ) end as coach,
        case when client.id is null then null else jsonb_build_object(
          'id', client.id::text, 'full_name', client.full_name, 'email', client.email, 'status', client.status
        ) end as client,
        case when matched.id is null then null else jsonb_build_object(
          'id', matched.id::text, 'client_id', matched.client_id::text, 'coach_id', matched.coach_id::text,
          'title', matched.title, 'display_title', matched.display_title, 'started_at', matched.started_at::text,
          'summary', matched.summary, 'recording_url', matched.recording_url, 'share_url', matched.share_url,
          'calendar_event_id', matched.calendar_event_id::text
        ) end as "matchedCall"
      from public.calendar_events source
      left join public.coaches coach on coach.id = source.coach_id
      left join public.clients client on client.id = source.client_id
      left join public.calls matched on matched.id = source.matched_call_id
      where source.starts_at >= $1::timestamptz and source.starts_at < $2::timestamptz ${coachFilter}
      order by source.starts_at`,
      params
    ),
    sql.query(
      `select
        source.id::text, source.client_id::text, source.coach_id::text, source.title,
        source.display_title, source.started_at::text, source.summary, source.recording_url,
        source.share_url, source.calendar_event_id::text,
        case when coach.id is null then null else jsonb_build_object(
          'id', coach.id::text, 'full_name', coach.full_name, 'email', coach.email
        ) end as coach,
        case when client.id is null then null else jsonb_build_object(
          'id', client.id::text, 'full_name', client.full_name, 'email', client.email, 'status', client.status
        ) end as client
      from public.calls source
      left join public.coaches coach on coach.id = source.coach_id
      left join public.clients client on client.id = source.client_id
      where source.started_at >= $1::timestamptz and source.started_at < $2::timestamptz ${coachFilter}
      order by source.started_at`,
      params
    ),
  ]);

  const events = eventRows as unknown as AdminCalendarEvent[];
  const matchedEventIds = new Set(events.map((event) => event.matchedCall?.calendar_event_id).filter(Boolean));
  const unscheduledCalls = (callRows as unknown as AdminUnscheduledCall[]).filter(
    (call) => !call.calendar_event_id || !matchedEventIds.has(call.calendar_event_id)
  );

  return {
    events,
    unscheduledCalls,
    coaches: coaches as unknown as Pick<Coach, "id" | "full_name" | "email">[],
  };
}

export interface DailyCallSegment {
  coachId: string;
  name: string;
  count: number;
}

export interface DailyCallBar {
  date: string; // YYYY-MM-DD (UTC)
  total: number;
  // Solo coaches con >=1 llamada ese día, en el mismo orden fijo que
  // `coachCalls` (alfabético) — así el color de cada coach es siempre el
  // mismo sin importar qué días aparezca.
  segments: DailyCallSegment[];
}

export interface CoachCallCount {
  coachId: string;
  name: string;
  count: number;
}

export interface StatusBreakdown {
  active: number;
  extension: number;
  inactive: number;
}

export interface AdminAnalytics {
  days: number;
  dailyCalls: DailyCallBar[];
  coachCalls: CoachCallCount[];
  statusBreakdown: StatusBreakdown;
  totalCallsInRange: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export async function getAdminAnalytics({ days = 30 }: { days?: number }): Promise<AdminAnalytics> {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const fromUTC = todayUTC - (days - 1) * DAY_MS;
  const from = new Date(fromUTC).toISOString();
  const to = new Date(todayUTC + DAY_MS).toISOString();

  const sql = getSql();
  const [coachRows, callRows, statusRows] = await Promise.all([
    sql`
      select id::text, full_name, email
      from public.coaches
      where is_active = true
      order by full_name nulls last, email
    `,
    sql`
      select started_at::text, coach_id::text
      from public.calls
      where started_at >= ${from}::timestamptz and started_at < ${to}::timestamptz
    `,
    sql`
      select status, count(*)::int as count
      from public.clients
      group by status
    `,
  ]);

  const coaches = coachRows as unknown as Pick<Coach, "id" | "full_name" | "email">[];
  const calls = callRows as unknown as { started_at: string | null; coach_id: string | null }[];
  const statusCounts = new Map(statusRows.map((row) => [String(row.status), Number(row.count)]));

  // Zero-filled día a día para que el eje X sea continuo aunque falten datos,
  // con un sub-conteo por coach para poder apilar la barra de cada día.
  const dayCoachBuckets = new Map<string, Map<string, number>>();
  for (let i = 0; i < days; i++) {
    dayCoachBuckets.set(new Date(fromUTC + i * DAY_MS).toISOString().slice(0, 10), new Map());
  }
  for (const call of calls) {
    if (!call.started_at || !call.coach_id) continue;
    const key = call.started_at.slice(0, 10);
    const dayMap = dayCoachBuckets.get(key);
    if (!dayMap) continue;
    dayMap.set(call.coach_id, (dayMap.get(call.coach_id) ?? 0) + 1);
  }

  const dailyCalls: DailyCallBar[] = Array.from(dayCoachBuckets.entries()).map(([date, dayMap]) => {
    const segments = coaches
      .map((coach) => ({ coachId: coach.id, name: coach.full_name || coach.email, count: dayMap.get(coach.id) ?? 0 }))
      .filter((s) => s.count > 0);
    return { date, total: segments.reduce((sum, s) => sum + s.count, 0), segments };
  });

  const coachCallCounts = new Map<string, number>();
  for (const call of calls) {
    if (!call.coach_id) continue;
    coachCallCounts.set(call.coach_id, (coachCallCounts.get(call.coach_id) ?? 0) + 1);
  }

  return {
    days,
    dailyCalls,
    coachCalls: coaches.map((coach) => ({
      coachId: coach.id,
      name: coach.full_name || coach.email,
      count: coachCallCounts.get(coach.id) ?? 0,
    })),
    statusBreakdown: {
      active: statusCounts.get("active") ?? 0,
      extension: statusCounts.get("extension") ?? 0,
      inactive: statusCounts.get("inactive") ?? 0,
    },
    totalCallsInRange: calls.length,
  };
}

export interface MonthCalendarCall {
  id: string;
  coachId: string | null;
  coachName: string;
  clientId: string | null;
  clientName: string | null;
  title: string | null;
  display_title: string | null;
  summary: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  hasSummary: boolean;
}

export interface AdminMonthCalendar {
  coaches: { coachId: string; name: string }[];
  calls: MonthCalendarCall[];
}

// Todas las llamadas del mes, de todos los coaches a la vez (a diferencia de
// getAdminFathomCalendarDashboard, que trae un coach a la vez) — para poder
// mostrarlas todas juntas en el calendario tipo Google, con checkboxes por
// coach que filtran del lado del cliente sin recargar.
export async function getAdminMonthCalendar({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<AdminMonthCalendar> {
  const sql = getSql();
  const [coachRows, calls] = await Promise.all([
    sql`
      select id::text, full_name, email
      from public.coaches
      where is_active = true
      order by full_name nulls last, email
    `,
    sql`
      select
        call.id::text as id,
        call.client_id::text as "clientId",
        call.coach_id::text as "coachId",
        coalesce(coach.full_name, coach.email, 'Sin coach') as "coachName",
        case when client.id is null then null else coalesce(client.full_name, client.email) end as "clientName",
        call.title,
        call.display_title,
        call.summary,
        call.started_at::text,
        call.duration_seconds,
        call.recording_url,
        (call.summary is not null) as "hasSummary"
      from public.calls call
      left join public.coaches coach on coach.id = call.coach_id
      left join public.clients client on client.id = call.client_id
      where call.started_at >= ${from}::timestamptz and call.started_at < ${to}::timestamptz
      order by call.started_at
    `,
  ]);

  const coaches = coachRows as unknown as Pick<Coach, "id" | "full_name" | "email">[];

  return {
    coaches: coaches.map((c) => ({ coachId: c.id, name: c.full_name || c.email })),
    calls: calls as unknown as MonthCalendarCall[],
  };
}

export interface CoachCallCountForRange {
  coachId: string;
  name: string;
  count: number;
}

// Conteo de llamadas por coach en un rango de fechas — para el reporte de
// pago mensual en /admin/coaches (no confundir con getAdminAnalytics, que
// trae el desglose día a día para la gráfica; acá solo hace falta el total).
export async function getCoachCallCounts({ from, to }: { from: string; to: string }): Promise<CoachCallCountForRange[]> {
  const sql = getSql();
  const rows = await sql`
    select
      coach.id::text as "coachId",
      coalesce(coach.full_name, coach.email) as name,
      count(call.id)::int as count
    from public.coaches coach
    left join public.calls call
      on call.coach_id = coach.id
      and call.started_at >= ${from}::timestamptz
      and call.started_at < ${to}::timestamptz
    where coach.is_active = true
    group by coach.id
    order by coach.full_name nulls last, coach.email
  `;
  return rows as unknown as CoachCallCountForRange[];
}
