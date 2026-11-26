-- Masterclases: tres categorías (Inteligencia artificial, Executive Lab, Guías),
-- fecha de publicación, portada opcional y materiales adjuntos.
-- Reutiliza la columna existente `category` (antes 'ai' | 'caro').
-- Idempotente. El script scripts/setup-masterclass-categories.mjs lo corre en una transacción.

alter table public.masterclasses add column if not exists published_at timestamptz;
alter table public.masterclasses add column if not exists cover_url text;
alter table public.masterclasses add column if not exists resources jsonb not null default '[]'::jsonb;

-- Quita los checks viejos de categoría y de duración (nombres autogenerados por Postgres).
do $$
declare c record;
begin
  for c in select conname, pg_get_constraintdef(oid) as def from pg_constraint
    where conrelid = 'public.masterclasses'::regclass and contype = 'c'
  loop
    if c.def ilike '%category%' and c.def ilike '%caro%'
      or (c.def ilike '%duration_minutes IS NOT NULL%' and c.def not ilike '%guides%') then
      execute format('alter table public.masterclasses drop constraint %I', c.conname);
    end if;
  end loop;
end $$;

-- Todas las clases actuales quedan en "Inteligencia artificial".
update public.masterclasses set category = 'ai' where category not in ('ai', 'executive_lab', 'guides');
alter table public.masterclasses alter column category set default 'ai';

-- Las grabaciones ya publicadas toman su fecha de clase como fecha de publicación.
update public.masterclasses set published_at = starts_at where status = 'recording' and published_at is null;

-- Las guías pueden no tener fecha de clase en vivo.
alter table public.masterclasses alter column starts_at drop not null;

alter table public.masterclasses drop constraint if exists masterclasses_category_check;
alter table public.masterclasses drop constraint if exists masterclasses_starts_at_required;
alter table public.masterclasses drop constraint if exists masterclasses_guides_status;
alter table public.masterclasses drop constraint if exists masterclasses_duration_required;
alter table public.masterclasses drop constraint if exists masterclasses_recording_source;
alter table public.masterclasses drop constraint if exists masterclasses_resources_shape;
alter table public.masterclasses drop constraint if exists masterclasses_published_at_required;

alter table public.masterclasses add constraint masterclasses_category_check
  check (category in ('ai', 'executive_lab', 'guides'));
alter table public.masterclasses add constraint masterclasses_starts_at_required
  check (category = 'guides' or starts_at is not null);
alter table public.masterclasses add constraint masterclasses_guides_status
  check (category <> 'guides' or status in ('draft', 'recording'));
alter table public.masterclasses add constraint masterclasses_duration_required
  check (status = 'recording' or category = 'guides' or duration_minutes is not null);
alter table public.masterclasses add constraint masterclasses_resources_shape
  check (jsonb_typeof(resources) = 'array' and jsonb_array_length(resources) <= 20);
alter table public.masterclasses add constraint masterclasses_recording_source
  check (status <> 'recording' or drive_url is not null or fathom_url is not null
    or (category = 'guides' and jsonb_array_length(resources) > 0));
alter table public.masterclasses add constraint masterclasses_published_at_required
  check (status <> 'recording' or published_at is not null);

