export type UserRole = "client" | "coach" | "admin";
export type ClientStatus = "active" | "inactive" | "extension";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
}

export interface Coach {
  id: string;
  profile_id: string | null;
  email: string;
  full_name: string | null;
  fathom_source_key: string | null;
  calendar_source_key: string | null;
  is_active: boolean;
}

export interface Client {
  id: string;
  profile_id: string | null;
  email: string;
  full_name: string | null;
  status: ClientStatus;
  drive_folder_url: string | null;
  drive_folder_id: string | null;
  first_call_id: string | null;
  context_summary: string | null;
  context_source_call_id: string | null;
  context_generated_at: string | null;
  notes: string | null;
  desired_salary_range: string | null;
}

export interface CoachClientAssignment {
  id: string;
  coach_id: string;
  client_id: string;
  is_primary: boolean;
  starts_on: string | null;
  ends_on: string | null;
}

export interface Call {
  id: string;
  client_id: string | null;
  coach_id: string | null;
  source: string | null;
  fathom_call_id: string | null;
  title: string | null;
  display_title: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
  next_steps: string | null;
  recording_url: string | null;
  share_url: string | null;
  calendar_event_id: string | null;
  raw_metadata: Record<string, unknown> | null;
}

export interface CallParticipant {
  id: string;
  call_id: string;
  email: string | null;
  name: string | null;
  role_hint: string | null;
}

export interface CalendarEvent {
  id: string;
  coach_id: string | null;
  client_id: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  title: string | null;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  attendee_emails: string[] | null;
  status: string | null;
  matched_call_id: string | null;
  ignored_reason: string | null;
  raw_metadata: Record<string, unknown> | null;
}

export interface ClientFile {
  id: string;
  client_id: string;
  google_file_id: string | null;
  name: string | null;
  mime_type: string | null;
  url: string | null;
  parent_folder_id: string | null;
}

// Minimal Database type so @supabase/ssr generics compile without a full
// generated schema. Table-level typing is done manually in each query.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
