begin;
create table if not exists public.client_progress_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(trim(label)) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists client_progress_categories_label on public.client_progress_categories (lower(trim(label)));
create table if not exists public.client_progress_states (
  client_id uuid primary key references public.clients(id) on delete cascade,
  category_id uuid references public.client_progress_categories(id),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.client_progress_categories enable row level security;
alter table public.client_progress_states enable row level security;
revoke all on public.client_progress_categories, public.client_progress_states from public, anon, authenticated;
insert into public.client_progress_categories (label) values
  ('Pendiente de pago'), ('Pagado'), ('Consiguió trabajo'), ('En seguimiento')
on conflict do nothing;
commit;
