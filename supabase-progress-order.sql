-- Orden de entrada (como la hoja "Ingresos 2026") y un único coach principal por cliente.
alter table public.clients add column if not exists entry_order integer;
create unique index if not exists clients_entry_order_key on public.clients (entry_order) where entry_order is not null;

-- Los clientes nuevos reciben automáticamente el siguiente número (al final).
create or replace function public.set_client_entry_order() returns trigger language plpgsql as $$
begin
  if new.entry_order is null then
    new.entry_order := coalesce((select max(entry_order) from public.clients), 0) + 1;
  end if;
  return new;
end $$;
drop trigger if exists clients_entry_order on public.clients;
create trigger clients_entry_order before insert on public.clients for each row execute function public.set_client_entry_order();

-- Un cliente tiene como máximo un coach principal (coach_client_assignments.is_primary).
create unique index if not exists coach_client_one_primary on public.coach_client_assignments (client_id) where is_primary;
