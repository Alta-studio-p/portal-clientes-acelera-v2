import "server-only";

import { getSql } from "@/lib/db";
import type { Call, CallParticipant, CalendarEvent, Client, ClientFile, Coach } from "@/lib/supabase/types";

export interface ClientDetail extends Client {
  coaches: { id: string; full_name: string | null; email: string; is_primary: boolean }[];
  calls: (Call & { participants: CallParticipant[] })[];
  files: ClientFile[];
  calendarEvents: CalendarEvent[];
}

type ClientWithCoaches = Client & { coaches: ClientDetail["coaches"] };

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const sql = getSql();
  const clients = await sql`
    select
      c.id::text,
      c.profile_id::text,
      c.email,
      c.full_name,
      c.status,
      c.drive_folder_url,
      c.drive_folder_id,
      c.first_call_id::text,
      c.context_summary,
      c.context_source_call_id::text,
      c.context_generated_at::text,
      c.notes,
      c.desired_salary_range,
      c.start_date::text,
      c.end_date::text,
      coalesce(
        jsonb_agg(
          distinct jsonb_build_object(
            'id', coach.id::text,
            'full_name', coach.full_name,
            'email', coach.email,
            'is_primary', assignment.is_primary
          )
        ) filter (where coach.id is not null),
        '[]'::jsonb
      ) as coaches
    from public.clients c
    left join public.coach_client_assignments assignment on assignment.client_id = c.id
    left join public.coaches coach on coach.id = assignment.coach_id
    where c.id = ${clientId}::uuid
    group by c.id
    limit 1
  `;

  if (!clients[0]) return null;
  const client = clients[0] as unknown as ClientWithCoaches;

  const [calls, files, events] = await Promise.all([
    sql`
      select
        call.id::text,
        call.client_id::text,
        call.coach_id::text,
        call.source,
        call.fathom_call_id,
        call.title,
        call.display_title,
        call.started_at::text,
        call.duration_seconds,
        call.summary,
        call.next_steps,
        call.recording_url,
        call.share_url,
        call.calendar_event_id::text,
        call.raw_metadata,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', participant.id::text,
              'call_id', participant.call_id::text,
              'email', participant.email,
              'name', participant.name,
              'role_hint', participant.role_hint
            ) order by participant.created_at
          ) filter (where participant.id is not null),
          '[]'::jsonb
        ) as participants
      from public.calls call
      left join public.call_participants participant on participant.call_id = call.id
      where call.client_id = ${clientId}::uuid
      group by call.id
      order by call.started_at desc nulls last
    `,
    sql`
      select id::text, client_id::text, google_file_id, name, mime_type, url, parent_folder_id
      from public.client_files
      where client_id = ${clientId}::uuid
      order by name
    `,
    sql`
      select
        id::text, coach_id::text, client_id::text, google_event_id, google_calendar_id,
        title, description, starts_at::text, ends_at::text, attendee_emails, status,
        matched_call_id::text, ignored_reason, raw_metadata
      from public.calendar_events
      where client_id = ${clientId}::uuid
      order by starts_at desc
    `,
  ]);

  return {
    ...client,
    coaches: client.coaches ?? [],
    calls: calls as unknown as ClientDetail["calls"],
    files: files as unknown as ClientFile[],
    calendarEvents: events as unknown as CalendarEvent[],
  };
}

export async function getClientIdsForCoach(coachId: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql`
    select client_id::text
    from public.coach_client_assignments
    where coach_id = ${coachId}::uuid
  `;
  return rows.map((row) => String(row.client_id));
}

export async function getCoachByProfileId(profileId: string): Promise<Coach | null> {
  const sql = getSql();
  const rows = await sql`
    select id::text, profile_id::text, email, full_name, fathom_source_key, calendar_source_key, is_active
    from public.coaches
    where profile_id = ${profileId}::uuid
    limit 1
  `;
  return (rows[0] as unknown as Coach | undefined) ?? null;
}

export async function getClientByProfileId(profileId: string): Promise<Client | null> {
  const sql = getSql();
  const rows = await sql`
    select
      id::text, profile_id::text, email, full_name, status, drive_folder_url, drive_folder_id,
      first_call_id::text, context_summary, context_source_call_id::text, context_generated_at::text,
      notes, desired_salary_range, start_date::text, end_date::text
    from public.clients
    where profile_id = ${profileId}::uuid
    limit 1
  `;
  return (rows[0] as unknown as Client | undefined) ?? null;
}
