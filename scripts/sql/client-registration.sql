-- Server-only counters: no email addresses or IP addresses are stored.
create schema if not exists private;
create table if not exists private.client_registration_limits (
  key text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table private.client_registration_limits enable row level security;
revoke all on private.client_registration_limits from public, anon, authenticated;
