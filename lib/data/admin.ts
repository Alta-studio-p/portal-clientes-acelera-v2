import { createClient } from "@/lib/supabase/server";
import type { Call, Client, Coach, ClientStatus } from "@/lib/supabase/types";

export interface AdminCounts {
  clients: number;
  coaches: number;
  calls: number;
  callsWithSummary: number;
  clientsWithContext: number;
}

export async function getAdminCounts(): Promise<AdminCounts> {
  const supabase = await createClient();

  const [clients, coaches, calls, callsWithSummary, clientsWithContext] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("coaches").select("id", { count: "exact", head: true }),
    supabase.from("calls").select("id", { count: "exact", head: true }),
    supabase.from("calls").select("id", { count: "exact", head: true }).not("summary", "is", null),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .not("context_summary", "is", null),
  ]);

  return {
    clients: clients.count ?? 0,
    coaches: coaches.count ?? 0,
    calls: calls.count ?? 0,
    callsWithSummary: callsWithSummary.count ?? 0,
    clientsWithContext: clientsWithContext.count ?? 0,
  };
}

export interface ClientListRow extends Client {
  coach_names: string[];
  call_count: number;
  last_call_at: string | null;
}

export async function getClientsList(filters: {
  coachId?: string;
  status?: ClientStatus;
  search?: string;
}): Promise<ClientListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select(
      `id, profile_id, email, full_name, status, drive_folder_url, drive_folder_id, first_call_id, context_summary, context_source_call_id, context_generated_at, notes,
       coach_client_assignments ( coach_id, is_primary, coaches ( id, full_name, email ) ),
       calls!calls_client_id_fkey ( id, started_at )`
    )
    .order("full_name", { ascending: true });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  type Row = Client & {
    coach_client_assignments: { coach_id: string; is_primary: boolean; coaches: { id: string; full_name: string | null; email: string } | null }[];
    calls: { id: string; started_at: string | null }[];
  };

  const rows = data as unknown as Row[];

  const mapped = rows.map((row) => {
    const calls = row.calls ?? [];
    const lastCall = calls
      .filter((c) => c.started_at)
      .sort((a, b) => (b.started_at! > a.started_at! ? 1 : -1))[0];

    return {
      ...row,
      coach_names: (row.coach_client_assignments ?? [])
        .map((a) => a.coaches?.full_name || a.coaches?.email)
        .filter((n): n is string => Boolean(n)),
      call_count: calls.length,
      last_call_at: lastCall?.started_at ?? null,
      _coach_ids: (row.coach_client_assignments ?? []).map((a) => a.coach_id),
    };
  });

  const filtered = filters.coachId
    ? mapped.filter((row) => row._coach_ids.includes(filters.coachId as string))
    : mapped;

  return filtered as unknown as ClientListRow[];
}

export interface CoachWithClients extends Coach {
  clients: { id: string; full_name: string | null; email: string; status: ClientStatus; is_primary: boolean }[];
}

export async function getCoachesWithClients(): Promise<CoachWithClients[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coaches")
    .select(
      `id, profile_id, email, full_name, fathom_source_key, calendar_source_key, is_active,
       coach_client_assignments ( is_primary, clients ( id, full_name, email, status ) )`
    )
    .order("full_name", { ascending: true });

  if (error || !data) return [];

  type Row = Coach & {
    coach_client_assignments: { is_primary: boolean; clients: { id: string; full_name: string | null; email: string; status: ClientStatus } | null }[];
  };

  return (data as unknown as Row[]).map((row) => ({
    ...row,
    clients: (row.coach_client_assignments ?? [])
      .filter((a) => a.clients)
      .map((a) => ({ ...(a.clients as NonNullable<typeof a.clients>), is_primary: a.is_primary })),
  }));
}

export async function getCallsNeedingAttention(): Promise<Call[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, client_id, coach_id, source, fathom_call_id, title, display_title, started_at, duration_seconds, summary, next_steps, recording_url, share_url, calendar_event_id, raw_metadata"
    )
    .or("summary.is.null,client_id.is.null")
    .order("started_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data as Call[];
}
