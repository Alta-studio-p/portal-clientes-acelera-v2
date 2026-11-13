begin;
create schema if not exists private;
create table if not exists private.claude_summary_jobs (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.calls(id) on delete set null,
  fixture boolean not null default false,
  source_hash text not null,
  snapshot jsonb not null,
  status text not null default 'pending' check(status in ('pending','starting','running','success','obsolete','error','expired','uncertain')),
  token_hash text,
  expires_at timestamptz,
  session_id text,
  result jsonb,
  error_code text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  finished_at timestamptz,
  unique(call_id,source_hash)
);
create index if not exists claude_summary_pending on private.claude_summary_jobs(status,created_at);
alter table private.claude_summary_jobs enable row level security;
revoke all on private.claude_summary_jobs from public,anon,authenticated,service_role;
commit;
