import "server-only";

import { neon } from "@neondatabase/serverless";
import { NEON_SCHEMA_STATEMENTS } from "@/lib/neon/schema";

export const SYNC_TABLES = [
  "profiles",
  "coaches",
  "clients",
  "calls",
  "coach_client_assignments",
  "call_participants",
  "calendar_events",
  "client_files",
  "sync_runs",
] as const;

type TableName = (typeof SYNC_TABLES)[number];
type Row = Record<string, unknown>;

async function fetchAllRows(baseUrl: string, key: string, table: TableName): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Supabase ${table} export failed (${response.status}).`);
    const page = (await response.json()) as Row[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function upsertQuery(table: TableName) {
  switch (table) {
    case "profiles":
      return `insert into public.profiles select * from jsonb_populate_recordset(null::public.profiles, $1::jsonb)
        on conflict (id) do update set email=excluded.email, full_name=excluded.full_name, role=excluded.role,
        created_at=excluded.created_at, updated_at=excluded.updated_at`;
    case "coaches":
      return `insert into public.coaches select * from jsonb_populate_recordset(null::public.coaches, $1::jsonb)
        on conflict (id) do update set profile_id=excluded.profile_id, email=excluded.email, full_name=excluded.full_name,
        fathom_source_key=excluded.fathom_source_key, calendar_source_key=excluded.calendar_source_key,
        is_active=excluded.is_active, created_at=excluded.created_at, updated_at=excluded.updated_at`;
    case "clients":
      return `insert into public.clients select * from jsonb_populate_recordset(null::public.clients, $1::jsonb)
        on conflict (id) do update set profile_id=excluded.profile_id, email=excluded.email, full_name=excluded.full_name,
        status=excluded.status, drive_folder_url=excluded.drive_folder_url, drive_folder_id=excluded.drive_folder_id,
        first_call_id=excluded.first_call_id, context_summary=excluded.context_summary,
        context_source_call_id=excluded.context_source_call_id, context_generated_at=excluded.context_generated_at,
        notes=excluded.notes, created_at=excluded.created_at, updated_at=excluded.updated_at,
        desired_salary_range=excluded.desired_salary_range,
        desired_salary_range_generated_at=excluded.desired_salary_range_generated_at,
        start_date=excluded.start_date, end_date=excluded.end_date`;
    case "calls":
      return `insert into public.calls select * from jsonb_populate_recordset(null::public.calls, $1::jsonb)
        on conflict (id) do update set client_id=excluded.client_id, coach_id=excluded.coach_id, source=excluded.source,
        fathom_call_id=excluded.fathom_call_id, title=excluded.title, started_at=excluded.started_at,
        duration_seconds=excluded.duration_seconds, summary=excluded.summary, next_steps=excluded.next_steps,
        recording_url=excluded.recording_url, share_url=excluded.share_url,
        calendar_event_id=excluded.calendar_event_id, raw_metadata=excluded.raw_metadata,
        created_at=excluded.created_at, updated_at=excluded.updated_at, display_title=excluded.display_title,
        display_title_generated_at=excluded.display_title_generated_at`;
    case "coach_client_assignments":
      return `insert into public.coach_client_assignments select * from jsonb_populate_recordset(null::public.coach_client_assignments, $1::jsonb)
        on conflict (id) do update set coach_id=excluded.coach_id, client_id=excluded.client_id,
        is_primary=excluded.is_primary, starts_on=excluded.starts_on, ends_on=excluded.ends_on,
        created_at=excluded.created_at`;
    case "call_participants":
      return `insert into public.call_participants select * from jsonb_populate_recordset(null::public.call_participants, $1::jsonb)
        on conflict (id) do update set call_id=excluded.call_id, email=excluded.email, name=excluded.name,
        role_hint=excluded.role_hint, created_at=excluded.created_at`;
    case "calendar_events":
      return `insert into public.calendar_events select * from jsonb_populate_recordset(null::public.calendar_events, $1::jsonb)
        on conflict (id) do update set coach_id=excluded.coach_id, client_id=excluded.client_id,
        google_event_id=excluded.google_event_id, google_calendar_id=excluded.google_calendar_id,
        title=excluded.title, description=excluded.description, starts_at=excluded.starts_at, ends_at=excluded.ends_at,
        attendee_emails=excluded.attendee_emails, status=excluded.status, matched_call_id=excluded.matched_call_id,
        ignored_reason=excluded.ignored_reason, raw_metadata=excluded.raw_metadata,
        created_at=excluded.created_at, updated_at=excluded.updated_at`;
    case "client_files":
      return `insert into public.client_files select * from jsonb_populate_recordset(null::public.client_files, $1::jsonb)
        on conflict (id) do update set client_id=excluded.client_id, google_file_id=excluded.google_file_id,
        name=excluded.name, mime_type=excluded.mime_type, url=excluded.url,
        parent_folder_id=excluded.parent_folder_id, created_at=excluded.created_at, updated_at=excluded.updated_at`;
    case "sync_runs":
      return `insert into public.sync_runs select * from jsonb_populate_recordset(null::public.sync_runs, $1::jsonb)
        on conflict (id) do update set source=excluded.source, source_key=excluded.source_key,
        started_at=excluded.started_at, finished_at=excluded.finished_at, status=excluded.status,
        records_seen=excluded.records_seen, records_inserted=excluded.records_inserted,
        records_updated=excluded.records_updated, error_message=excluded.error_message, metadata=excluded.metadata`;
  }
}

export async function syncSupabaseToNeon({ ensureSchema = false }: { ensureSchema?: boolean } = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!supabaseUrl || !supabaseKey || !databaseUrl) throw new Error("Missing database configuration.");

  const sourceEntries = await Promise.all(
    SYNC_TABLES.map(async (table) => [table, await fetchAllRows(supabaseUrl, supabaseKey, table)] as const)
  );
  const source = Object.fromEntries(sourceEntries) as Record<TableName, Row[]>;
  const sql = neon(databaseUrl);

  if (ensureSchema) {
    await sql.transaction(NEON_SCHEMA_STATEMENTS.map((statement) => sql.query(statement)));
  }

  for (const table of SYNC_TABLES) {
    if (source[table].length === 0) continue;
    await sql.query(upsertQuery(table), [JSON.stringify(source[table])]);
  }

  const validation = await sql`
    select 'profiles' as table_name, count(*)::int as count from public.profiles
    union all select 'coaches', count(*)::int from public.coaches
    union all select 'clients', count(*)::int from public.clients
    union all select 'calls', count(*)::int from public.calls
    union all select 'coach_client_assignments', count(*)::int from public.coach_client_assignments
    union all select 'call_participants', count(*)::int from public.call_participants
    union all select 'calendar_events', count(*)::int from public.calendar_events
    union all select 'client_files', count(*)::int from public.client_files
    union all select 'sync_runs', count(*)::int from public.sync_runs
  `;

  const sourceCounts = Object.fromEntries(SYNC_TABLES.map((table) => [table, source[table].length]));
  const targetCounts = Object.fromEntries(validation.map((row) => [String(row.table_name), Number(row.count)]));
  const targetHasAllSourceRows = SYNC_TABLES.every((table) => targetCounts[table] >= sourceCounts[table]);

  return { targetHasAllSourceRows, sourceCounts, targetCounts };
}
