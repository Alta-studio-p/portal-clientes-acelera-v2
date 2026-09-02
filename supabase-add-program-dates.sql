-- Agrega fechas de inicio/fin del programa a `clients`.
-- Ejecutar en el SQL editor del proyecto Supabase: lbxwephfuitsvlbetvlb
--
-- No modifica ni limita `clients.status` (sigue aceptando 'active' | 'inactive' | 'extension').
-- Los valores se cargan aparte vía script (scripts/update-client-program-dates.mjs).

alter table public.clients
  add column if not exists start_date date,
  add column if not exists end_date date;

comment on column public.clients.start_date is
  'Fecha de inicio del programa de coaching. Editable manualmente.';
comment on column public.clients.end_date is
  'Fecha final del programa. Por defecto start_date + 3 meses, editable manualmente para extensiones. Nunca se recalcula automáticamente a partir del estado.';
