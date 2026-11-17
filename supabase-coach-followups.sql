begin;
alter table private.claude_summary_jobs drop constraint if exists claude_summary_jobs_task_check;
alter table private.claude_summary_jobs add constraint claude_summary_jobs_task_check check(task in ('translate_call','classify_call','coach_followup'));
create table if not exists private.coach_followup_settings (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  starts_at timestamptz not null default now()
);
insert into private.coach_followup_settings(singleton) values(true) on conflict do nothing;
create table if not exists private.fathom_followup_hooks (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  provider_id text unique,
  signing_secret text,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists private.coach_followups (
  id uuid primary key default gen_random_uuid(),
  recording_id text unique not null,
  source_key text not null,
  webhook_id text not null,
  client_id uuid references public.clients(id),
  coach_id uuid references public.coaches(id),
  call_id uuid references public.calls(id),
  started_at timestamptz not null,
  recording_url text,
  snapshot jsonb not null,
  job_id uuid unique references private.claude_summary_jobs(id),
  result jsonb,
  status text not null default 'pending' check(status in ('pending','queued','ready','sending','sent','error','uncertain','blocked','skipped')),
  recipient_email text,
  attempts integer not null default 0,
  retry_at timestamptz,
  sending_at timestamptz,
  sent_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists coach_followup_queue on private.coach_followups(status,created_at);
alter table private.coach_followup_settings enable row level security;
alter table private.fathom_followup_hooks enable row level security;
alter table private.coach_followups enable row level security;
revoke all on private.coach_followup_settings,private.fathom_followup_hooks,private.coach_followups from public,anon,authenticated,service_role;
commit;
