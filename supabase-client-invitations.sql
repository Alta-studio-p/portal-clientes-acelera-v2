create table if not exists public.client_access_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  check (expires_at > created_at)
);
alter table public.client_access_invitations enable row level security;
revoke all on public.client_access_invitations from public, anon, authenticated;
