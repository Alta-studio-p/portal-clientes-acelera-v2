begin;
create schema if not exists private;

create table if not exists private.coaching_insight_attempts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  source_hash text not null,
  status text not null check (status in ('processing','success','error','obsolete')),
  reservation numeric not null default 0.02 check (reservation = 0.02),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  error_code text
);
create index if not exists coaching_attempt_client on private.coaching_insight_attempts(client_id,created_at desc);
create index if not exists coaching_attempt_budget on private.coaching_insight_attempts(created_at);

create table if not exists private.coaching_insights (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  source_hash text not null,
  model text not null,
  prompt_version text not null,
  source_call_ids jsonb not null,
  truncated boolean not null,
  analysis jsonb not null,
  input_tokens integer not null,
  output_tokens integer not null,
  cost_usd numeric,
  created_at timestamptz not null default now(),
  unique(client_id,source_hash)
);
create index if not exists coaching_insight_client on private.coaching_insights(client_id,created_at desc);

create table if not exists private.coaching_topic_reviews (
  client_id uuid not null references public.clients(id) on delete cascade,
  topic text not null check (topic in ('objetivo','perfil','cv','linkedin','networking','busqueda','entrevistas','ofertas')),
  state text not null check (state in ('pendiente','en_trabajo','trabajado','seguimiento')),
  note text not null default '' check (length(note)<=1000),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(client_id,topic)
);
create table if not exists private.coaching_recommendation_reviews (
  client_id uuid not null references public.clients(id) on delete cascade,
  recommendation_key text not null,
  state text not null check (state in ('accepted','dismissed','edited')),
  note text not null default '' check (length(note)<=1000),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(client_id,recommendation_key)
);
alter table private.coaching_insights enable row level security;
alter table private.coaching_insight_attempts enable row level security;
alter table private.coaching_topic_reviews enable row level security;
alter table private.coaching_recommendation_reviews enable row level security;
revoke all on private.coaching_insights,private.coaching_insight_attempts,private.coaching_topic_reviews,private.coaching_recommendation_reviews from public,anon,authenticated,service_role;
commit;
