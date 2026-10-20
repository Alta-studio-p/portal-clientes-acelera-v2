-- Additive preparation for consolidating the portal into Supabase.
-- Existing calls, client records, credentials and policies are not replaced.
begin;

create table if not exists public.coach_fees (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id),
  call_id uuid unique references public.calls(id),
  client_id uuid references public.clients(id),
  service_date date not null,
  topic text not null check (length(topic) between 1 and 500),
  hours numeric(8,2) check (hours > 0 and hours <= 9999),
  amount numeric(14,2) check (amount >= 0 and amount <= 999999999999),
  payment_type text check (payment_type in ('transfer', 'cash', 'other')),
  paid_on date,
  support_url text,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_on is null or (amount is not null and payment_type is not null))
);

alter table public.coach_fees enable row level security;
revoke all on public.coach_fees from public, anon, authenticated;
grant select, insert, update on public.coach_fees to service_role;

create or replace view public.client_sessions
with (security_invoker = true) as
  select original.*
  from public.calls original
  join (
    select id, row_number() over (
      partition by client_id, started_at, lower(trim(title)),
        case when source <> 'fathom' or client_id is null or started_at is null
          or coach_id is null or nullif(trim(title), '') is null
          or not exists (
            select 1 from public.calls other
            where other.source = 'fathom' and other.client_id = candidate.client_id
              and other.started_at = candidate.started_at
              and lower(trim(other.title)) = lower(trim(candidate.title))
              and other.coach_id <> candidate.coach_id
          ) then id else null end
      order by
        (nullif(trim(summary), '') is not null) desc,
        (coalesce(nullif(trim(share_url), ''), nullif(trim(recording_url), '')) is not null) desc,
        created_at asc, id asc
    ) as session_rank
    from public.calls candidate
  ) ranked on ranked.id = original.id and ranked.session_rank = 1;

revoke all on public.client_sessions from public, anon, authenticated;
grant select on public.client_sessions to service_role;

commit;
notify pgrst, 'reload schema';
