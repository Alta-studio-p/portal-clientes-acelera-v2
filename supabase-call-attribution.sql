-- Emails alternos para vincular llamadas a clientes y coaches.
alter table public.clients add column if not exists alternate_emails text[] not null default '{}';
alter table public.coaches add column if not exists alternate_emails text[] not null default '{}';
create index if not exists clients_alternate_emails_idx on public.clients using gin (alternate_emails);

-- Cómo se vinculó el cliente y cómo se decidió el coach de cada llamada.
alter table public.calls add column if not exists client_match_method text
  check (client_match_method in ('email', 'alt_email', 'name', 'manual'));
alter table public.calls add column if not exists coach_resolution text
  check (coach_resolution in ('recorded_by', 'fallback', 'manual'));
alter table public.calls add column if not exists coach_needs_confirmation boolean not null default false;

-- La coach principal no cobra por llamadas: no aparece en la sección Llamadas.
alter table public.coaches add column if not exists bills_by_call boolean not null default true;
