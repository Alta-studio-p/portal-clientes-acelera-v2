create table if not exists public.coach_fees (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id),
  call_id uuid unique references public.calls(id),
  client_id uuid references public.clients(id),
  service_date date not null,
  topic text not null check (length(topic) between 1 and 500),
  hours numeric(8,2) check (hours > 0 and hours <= 9999),
  amount numeric(14,2) check (amount >= 0 and amount <= 999999999999),
  payment_type text check (payment_type in ('transfer', 'cash', 'other')),
  paid_on date,
  support_url text,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_on is null or (amount is not null and payment_type is not null))
);
