begin;
create table if not exists public.client_progress_labels (
  client_id uuid not null references public.clients(id) on delete cascade,
  category_id uuid not null references public.client_progress_categories(id),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (client_id,category_id)
);
alter table public.client_progress_labels enable row level security;
revoke all on public.client_progress_labels from public,anon,authenticated;
insert into public.client_progress_labels (client_id,category_id,updated_by,updated_at)
select client_id,category_id,updated_by,updated_at from public.client_progress_states
where category_id is not null on conflict do nothing;

-- Keep requests from already-open single-select screens compatible during rollout.
create or replace function public.sync_legacy_progress_label() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and old.category_id is not null and old.category_id is distinct from new.category_id then
    delete from public.client_progress_labels where client_id=new.client_id and category_id=old.category_id;
  end if;
  if new.category_id is not null then
    insert into public.client_progress_labels (client_id,category_id,updated_by)
    values (new.client_id,new.category_id,new.updated_by)
    on conflict (client_id,category_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_legacy_progress_label() from public,anon,authenticated;
create or replace trigger sync_legacy_progress_label after insert or update on public.client_progress_states
for each row execute function public.sync_legacy_progress_label();
commit;
