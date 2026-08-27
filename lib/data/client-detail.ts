import { createClient } from "@/lib/supabase/server";
import type { Call, CallParticipant, CalendarEvent, Client, ClientFile, Coach } from "@/lib/supabase/types";

export interface ClientDetail extends Client {
  coaches: { id: string; full_name: string | null; email: string; is_primary: boolean }[];
  calls: (Call & { participants: CallParticipant[] })[];
  files: ClientFile[];
  calendarEvents: CalendarEvent[];
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select(
      `id, profile_id, email, full_name, status, drive_folder_url, drive_folder_id, first_call_id, context_summary, context_source_call_id, context_generated_at, notes, desired_salary_range,
       coach_client_assignments ( is_primary, coaches ( id, full_name, email ) )`
    )
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) return null;

  const [{ data: calls }, { data: files }, { data: events }] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "id, client_id, coach_id, source, fathom_call_id, title, display_title, started_at, duration_seconds, summary, next_steps, recording_url, share_url, calendar_event_id, raw_metadata, call_participants ( id, call_id, email, name, role_hint )"
      )
      .eq("client_id", clientId)
      .order("started_at", { ascending: false }),
    supabase.from("client_files").select("*").eq("client_id", clientId).order("name"),
    supabase
      .from("calendar_events")
      .select("*")
      .eq("client_id", clientId)
      .order("starts_at", { ascending: false }),
  ]);

  type ClientRow = Client & {
    coach_client_assignments: { is_primary: boolean; coaches: Coach | null }[];
  };
  type CallRow = Call & { call_participants: CallParticipant[] };

  const clientRow = client as unknown as ClientRow;

  return {
    ...clientRow,
    coaches: (clientRow.coach_client_assignments ?? [])
      .filter((a) => a.coaches)
      .map((a) => ({
        id: a.coaches!.id,
        full_name: a.coaches!.full_name,
        email: a.coaches!.email,
        is_primary: a.is_primary,
      })),
    calls: ((calls ?? []) as unknown as CallRow[]).map((c) => ({
      ...c,
      participants: c.call_participants ?? [],
    })),
    files: (files ?? []) as ClientFile[],
    calendarEvents: (events ?? []) as CalendarEvent[],
  };
}

export async function getClientIdsForCoach(coachId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coach_client_assignments")
    .select("client_id")
    .eq("coach_id", coachId);
  return (data ?? []).map((r) => r.client_id as string);
}

export async function getCoachByProfileId(profileId: string): Promise<Coach | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coaches")
    .select("id, profile_id, email, full_name, fathom_source_key, calendar_source_key, is_active")
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as Coach) ?? null;
}

export async function getClientByProfileId(profileId: string): Promise<Client | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(
      "id, profile_id, email, full_name, status, drive_folder_url, drive_folder_id, first_call_id, context_summary, context_source_call_id, context_generated_at, notes"
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  return (data as Client) ?? null;
}
