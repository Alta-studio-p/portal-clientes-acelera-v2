alter table public.calls add column if not exists classification_override_at timestamptz;
alter table private.claude_summary_jobs add column if not exists task text not null default 'translate_call'
  check (task in ('translate_call','classify_call'));
create table if not exists private.call_classifications (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id),
  source_hash text not null,
  job_id uuid not null references private.claude_summary_jobs(id),
  result jsonb not null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique(call_id,source_hash)
);
alter table private.call_classifications enable row level security;
revoke all on private.call_classifications from public,anon,authenticated,service_role;
alter table public.masterclasses add column if not exists category text not null default 'ai' check(category in ('ai','caro'));
alter table public.masterclasses add column if not exists fathom_url text;
alter table public.masterclasses add column if not exists source_call_id uuid unique references public.calls(id);
alter table public.masterclasses drop constraint if exists masterclasses_check2;
alter table public.masterclasses drop constraint if exists masterclasses_recording_source;
alter table public.masterclasses add constraint masterclasses_recording_source check(status<>'recording' or drive_url is not null or fathom_url is not null);
