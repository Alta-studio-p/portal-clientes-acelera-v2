import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, Call, Client, Coach, ClientStatus } from "@/lib/supabase/types";

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

export interface AdminFathomCalendarCall
  extends Pick<
    Call,
    "id" | "client_id" | "coach_id" | "title" | "display_title" | "started_at" | "duration_seconds" | "summary" | "recording_url" | "share_url"
  > {
  client: Pick<Client, "id" | "full_name" | "email" | "status"> | null;
}

export interface AdminFathomCalendarDashboard {
  coaches: Pick<Coach, "id" | "full_name" | "email">[];
  selectedCoach: Pick<Coach, "id" | "full_name" | "email"> | null;
  calls: AdminFathomCalendarCall[];
}

export async function getAdminFathomCalendarDashboard({
  from,
  to,
  coachId,
}: {
  from: string;
  to: string;
  coachId?: string;
}): Promise<AdminFathomCalendarDashboard> {
  const supabase = await createClient();

  const { data: coachesData } = await supabase
    .from("coaches")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const coaches = (coachesData ?? []) as Pick<Coach, "id" | "full_name" | "email">[];
  const selectedCoach = coaches.find((coach) => coach.id === coachId) ?? coaches[0] ?? null;

  if (!selectedCoach) {
    return { coaches, selectedCoach: null, calls: [] };
  }

  const { data: callsData } = await supabase
    .from("calls")
    .select(
      "id, client_id, coach_id, title, display_title, started_at, duration_seconds, summary, recording_url, share_url"
    )
    .eq("coach_id", selectedCoach.id)
    .gte("started_at", from)
    .lt("started_at", to)
    .order("started_at", { ascending: true });

  const calls = (callsData ?? []) as Pick<
    Call,
    "id" | "client_id" | "coach_id" | "title" | "display_title" | "started_at" | "duration_seconds" | "summary" | "recording_url" | "share_url"
  >[];

  const clientIds = Array.from(
    new Set(calls.map((call) => call.client_id).filter(Boolean))
  ) as string[];
  const { data: clientsData } = clientIds.length
    ? await supabase
        .from("clients")
        .select("id, full_name, email, status")
        .in("id", clientIds)
    : { data: [] };

  const clientMap = new Map(
    ((clientsData ?? []) as Pick<Client, "id" | "full_name" | "email" | "status">[]).map(
      (client) => [client.id, client]
    )
  );

  return {
    coaches,
    selectedCoach,
    calls: calls.map((call) => ({
      ...call,
      client: call.client_id ? clientMap.get(call.client_id) ?? null : null,
    })),
  };
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
  const supabase = await createClient();

  const coachesQuery = supabase
    .from("coaches")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  let eventsQuery = supabase
    .from("calendar_events")
    .select("*")
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true });

  let callsQuery = supabase
    .from("calls")
    .select(
      "id, client_id, coach_id, source, fathom_call_id, title, display_title, started_at, duration_seconds, summary, next_steps, recording_url, share_url, calendar_event_id, raw_metadata"
    )
    .gte("started_at", from)
    .lt("started_at", to)
    .order("started_at", { ascending: true });

  if (coachId) {
    eventsQuery = eventsQuery.eq("coach_id", coachId);
    callsQuery = callsQuery.eq("coach_id", coachId);
  }

  const [{ data: coachesData }, { data: eventsData }, { data: callsData }] = await Promise.all([
    coachesQuery,
    eventsQuery,
    callsQuery,
  ]);

  const coaches = (coachesData ?? []) as Pick<Coach, "id" | "full_name" | "email">[];
  const events = (eventsData ?? []) as CalendarEvent[];
  const calls = (callsData ?? []) as Call[];

  const coachIds = new Set<string>();
  const clientIds = new Set<string>();
  const matchedCallIds = new Set<string>();

  for (const event of events) {
    if (event.coach_id) coachIds.add(event.coach_id);
    if (event.client_id) clientIds.add(event.client_id);
    if (event.matched_call_id) matchedCallIds.add(event.matched_call_id);
  }

  for (const call of calls) {
    if (call.coach_id) coachIds.add(call.coach_id);
    if (call.client_id) clientIds.add(call.client_id);
  }

  const [{ data: relatedCoaches }, { data: relatedClients }, { data: matchedCalls }] =
    await Promise.all([
      coachIds.size
        ? supabase
            .from("coaches")
            .select("id, full_name, email")
            .in("id", Array.from(coachIds))
        : Promise.resolve({ data: [] }),
      clientIds.size
        ? supabase
            .from("clients")
            .select("id, full_name, email, status")
            .in("id", Array.from(clientIds))
        : Promise.resolve({ data: [] }),
      matchedCallIds.size
        ? supabase
            .from("calls")
            .select(
              "id, client_id, coach_id, title, display_title, started_at, summary, recording_url, share_url, calendar_event_id"
            )
            .in("id", Array.from(matchedCallIds))
        : Promise.resolve({ data: [] }),
    ]);

  const coachMap = new Map(
    ((relatedCoaches ?? coaches) as Pick<Coach, "id" | "full_name" | "email">[]).map((coach) => [
      coach.id,
      coach,
    ])
  );
  for (const coach of coaches) coachMap.set(coach.id, coach);

  const clientMap = new Map(
    ((relatedClients ?? []) as Pick<Client, "id" | "full_name" | "email" | "status">[]).map(
      (client) => [client.id, client]
    )
  );
  const matchedCallMap = new Map(
    ((matchedCalls ?? []) as AdminCalendarEvent["matchedCall"][])
      .filter((call): call is NonNullable<AdminCalendarEvent["matchedCall"]> => Boolean(call))
      .map((call) => [call.id, call])
  );

  const callsByCalendarEvent = new Map<string, Call>();
  for (const call of calls) {
    if (call.calendar_event_id) callsByCalendarEvent.set(call.calendar_event_id, call);
  }

  const mappedEvents = events.map((event) => {
    const matchedCall =
      (event.matched_call_id ? matchedCallMap.get(event.matched_call_id) : null) ??
      (event.id ? callsByCalendarEvent.get(event.id) : null) ??
      null;

    return {
      ...event,
      coach: event.coach_id ? coachMap.get(event.coach_id) ?? null : null,
      client: event.client_id ? clientMap.get(event.client_id) ?? null : null,
      matchedCall: matchedCall as AdminCalendarEvent["matchedCall"],
    };
  });

  const matchedEventIds = new Set(mappedEvents.map((event) => event.matchedCall?.calendar_event_id).filter(Boolean));
  const unscheduledCalls = calls
    .filter((call) => !call.calendar_event_id || !matchedEventIds.has(call.calendar_event_id))
    .map((call) => ({
      id: call.id,
      client_id: call.client_id,
      coach_id: call.coach_id,
      title: call.title,
      display_title: call.display_title,
      started_at: call.started_at,
      summary: call.summary,
      recording_url: call.recording_url,
      share_url: call.share_url,
      calendar_event_id: call.calendar_event_id,
      coach: call.coach_id ? coachMap.get(call.coach_id) ?? null : null,
      client: call.client_id ? clientMap.get(call.client_id) ?? null : null,
    }));

  return {
    events: mappedEvents,
    unscheduledCalls,
    coaches,
  };
}
