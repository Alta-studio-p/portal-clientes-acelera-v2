-- Row Level Security para Portal Clientes Acelera v2
-- Ejecutar en el SQL editor del proyecto Supabase: lbxwephfuitsvlbetvlb
--
-- Modelo de roles: profiles.role in ('client', 'coach', 'admin')
-- - admin: acceso total de lectura.
-- - coach: lectura de sus clientes asignados (via coach_client_assignments) y datos relacionados.
-- - client: lectura de su propio registro en `clients` (via clients.profile_id) y datos relacionados.
--
-- Este script solo agrega políticas de LECTURA (select) para el frontend.
-- Toda escritura (import de Fathom, cambios de estado, etc.) debe hacerse con
-- el service role key desde scripts de servidor, nunca desde el navegador.

-- 1. Funciones helper -------------------------------------------------------
-- drop primero por si ya existían con otra firma/tipo de retorno (p.ej. de un
-- intento anterior), ya que "create or replace" no puede cambiar el tipo.

drop function if exists public.current_profile_role() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.current_coach_id() cascade;
drop function if exists public.current_client_id() cascade;

create or replace function public.current_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

create or replace function public.current_coach_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.coaches where profile_id = auth.uid();
$$;

create or replace function public.current_client_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.clients where profile_id = auth.uid();
$$;

-- 2. Enable RLS ---------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.coaches enable row level security;
alter table public.clients enable row level security;
alter table public.coach_client_assignments enable row level security;
alter table public.calls enable row level security;
alter table public.call_participants enable row level security;
alter table public.calendar_events enable row level security;
alter table public.client_files enable row level security;
alter table public.sync_runs enable row level security;

grant usage on schema public to authenticated;
grant select on
  public.profiles,
  public.coaches,
  public.clients,
  public.coach_client_assignments,
  public.calls,
  public.call_participants,
  public.calendar_events,
  public.client_files
to authenticated;

-- 3. profiles ---------------------------------------------------------------

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- 4. coaches ------------------------------------------------------------

drop policy if exists "coaches_select" on public.coaches;
create policy "coaches_select"
on public.coaches for select
to authenticated
using (
  public.is_admin()
  or profile_id = auth.uid()
  or exists (
    select 1 from public.coach_client_assignments a
    where a.coach_id = coaches.id
      and a.client_id = public.current_client_id()
  )
);

-- 5. clients --------------------------------------------------------------

drop policy if exists "clients_select" on public.clients;
create policy "clients_select"
on public.clients for select
to authenticated
using (
  public.is_admin()
  or profile_id = auth.uid()
  or exists (
    select 1 from public.coach_client_assignments a
    where a.client_id = clients.id
      and a.coach_id = public.current_coach_id()
  )
);

-- 6. coach_client_assignments ---------------------------------------------

drop policy if exists "assignments_select" on public.coach_client_assignments;
create policy "assignments_select"
on public.coach_client_assignments for select
to authenticated
using (
  public.is_admin()
  or coach_id = public.current_coach_id()
  or client_id = public.current_client_id()
);

-- 7. calls ------------------------------------------------------------------

drop policy if exists "calls_select" on public.calls;
create policy "calls_select"
on public.calls for select
to authenticated
using (
  public.is_admin()
  or client_id = public.current_client_id()
  or coach_id = public.current_coach_id()
);

-- 8. call_participants --------------------------------------------------

drop policy if exists "call_participants_select" on public.call_participants;
create policy "call_participants_select"
on public.call_participants for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.calls c
    where c.id = call_participants.call_id
      and (c.client_id = public.current_client_id() or c.coach_id = public.current_coach_id())
  )
);

-- 9. calendar_events ------------------------------------------------------

drop policy if exists "calendar_events_select" on public.calendar_events;
create policy "calendar_events_select"
on public.calendar_events for select
to authenticated
using (
  public.is_admin()
  or client_id = public.current_client_id()
  or coach_id = public.current_coach_id()
);

-- 10. client_files ----------------------------------------------------------

drop policy if exists "client_files_select" on public.client_files;
create policy "client_files_select"
on public.client_files for select
to authenticated
using (
  public.is_admin()
  or client_id = public.current_client_id()
  or exists (
    select 1 from public.coach_client_assignments a
    where a.client_id = client_files.client_id
      and a.coach_id = public.current_coach_id()
  )
);

-- 11. sync_runs -- solo admin ------------------------------------------------

drop policy if exists "sync_runs_select" on public.sync_runs;
create policy "sync_runs_select"
on public.sync_runs for select
to authenticated
using (public.is_admin());
