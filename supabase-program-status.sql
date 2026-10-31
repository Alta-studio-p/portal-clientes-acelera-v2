-- Estado del programa calculado por la fecha de fin. Misma regla que lib/program-phase.mjs.
--   fin posterior a hoy → active · fin hoy o pasó hace ≤ 15 días → active (recién finalizado) · pasó hace > 15 días → inactive.
--   Excepción: 'inactive' con fin futuro = cerrado a mano antes de su fecha de fin; se respeta.
--   Sin fecha de fin → se deja el estado guardado. La extensión (extension) se conserva mientras no haya terminado.
create or replace function public.client_program_status(
  p_status public.client_status, p_end date,
  p_today date default (now() at time zone 'America/Bogota')::date, p_respect_manual boolean default true
) returns public.client_status language sql stable as $$
  select case
    when p_end is null then p_status
    when p_respect_manual and p_status = 'inactive' and p_end > p_today then 'inactive'::public.client_status
    when p_today - p_end > 15 then 'inactive'::public.client_status
    when p_status = 'extension' then 'extension'::public.client_status
    else 'active'::public.client_status
  end
$$;

-- Sincroniza el estado guardado de todos los clientes; devuelve cuántos cambió. Lo ejecuta la importación diaria.
create or replace function public.sync_client_program_status() returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.clients c set status = public.client_program_status(c.status, c.end_date)
  where c.end_date is not null and c.status is distinct from public.client_program_status(c.status, c.end_date);
  get diagnostics changed = row_count;
  return changed;
end $$;
revoke all on function public.sync_client_program_status() from public, anon, authenticated;
grant execute on function public.sync_client_program_status() to service_role;

-- Si cambia la fecha de fin (por ejemplo una extensión), el estado se recalcula solo, sin respetar el cierre manual anterior.
create or replace function public.recalc_client_status_on_end_date() returns trigger language plpgsql as $$
begin
  if new.end_date is not null and (tg_op = 'INSERT' or new.end_date is distinct from old.end_date) then
    new.status := public.client_program_status(new.status, new.end_date, (now() at time zone 'America/Bogota')::date, false);
  end if;
  return new;
end $$;
drop trigger if exists clients_recalc_status on public.clients;
create trigger clients_recalc_status before insert or update of end_date on public.clients for each row execute function public.recalc_client_status_on_end_date();
