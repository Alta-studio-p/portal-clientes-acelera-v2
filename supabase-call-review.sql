alter table public.calls add column if not exists discarded_at timestamptz;
alter table public.calls add column if not exists discard_reason text
  check (discard_reason in ('no_show','internal','unrelated'));
alter table public.calls add column if not exists discarded_by uuid;

create schema if not exists private;
create table if not exists private.call_review_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id),
  action text not null check (action in ('discard','restore')),
  reason text check (reason in ('no_show','internal','unrelated')),
  actor_id uuid not null,
  actor_role text not null check (actor_role in ('admin','coach')),
  created_at timestamptz not null default now()
);
alter table private.call_review_events enable row level security;
revoke all on private.call_review_events from public,anon,authenticated,service_role;

create or replace function private.preserve_discarded_call_assignment()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.discarded_at is not null and new.discarded_at is not null then
    if new.client_id is distinct from old.client_id then
      raise exception 'discarded_call_assignment';
    end if;
    new.client_id := old.client_id;
    new.coach_id := old.coach_id;
  end if;
  return new;
end;
$$;
revoke all on function private.preserve_discarded_call_assignment() from public,anon,authenticated,service_role;
create or replace trigger preserve_discarded_call_assignment
before update on public.calls for each row
execute function private.preserve_discarded_call_assignment();

create or replace function private.guard_discarded_call_fee()
returns trigger language plpgsql set search_path='' as $$
declare v_discarded timestamptz;
begin
  if new.call_id is not null then
    select c.discarded_at into v_discarded from public.calls c where c.id=new.call_id for update;
    if v_discarded is not null then raise exception 'discarded_call_fee'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_discarded_call_fee() from public,anon,authenticated,service_role;
create or replace trigger guard_discarded_call_fee
before insert or update on public.coach_fees for each row
execute function private.guard_discarded_call_fee();
