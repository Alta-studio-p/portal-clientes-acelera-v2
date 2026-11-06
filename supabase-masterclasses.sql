begin;

create table if not exists public.masterclasses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  previous_starts_at timestamptz,
  duration_minutes integer check (duration_minutes between 5 and 480),
  status text not null check (status in ('draft', 'scheduled', 'cancelled', 'recording')),
  live_url text,
  drive_url text,
  check (status <> 'scheduled' or live_url is not null),
  check (status = 'recording' or duration_minutes is not null),
  check (status <> 'recording' or drive_url is not null)
);

alter table public.masterclasses enable row level security;
revoke all on public.masterclasses from public, anon, authenticated;

commit;
