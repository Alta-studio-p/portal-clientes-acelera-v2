begin;

alter table public.clients add column if not exists onboarding_email text;
create unique index if not exists clients_onboarding_email_unique
  on public.clients (lower(trim(onboarding_email))) where onboarding_email is not null;

create or replace function public.create_client_from_onboarding(
  p_name text, p_email text, p_recordings text[], p_primary_recording text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_primary public.calls%rowtype;
  v_count integer;
  v_day date;
begin
  p_name := trim(p_name);
  p_email := lower(trim(p_email));
  if p_name is null or char_length(p_name) not between 3 and 160
    or p_email is null or char_length(p_email) > 254 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    or coalesce(cardinality(p_recordings), 0) not between 1 and 8 then
    raise exception 'Invalid onboarding candidate';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('acelera_onboarding_intake', 0));
  if exists (
    select 1 from public.clients c where lower(trim(c.email)) = p_email
      or lower(trim(c.onboarding_email)) = p_email
      or lower(trim(c.full_name)) = lower(p_name)
      or exists (select 1 from unnest(c.alternate_emails) e where lower(trim(e)) = p_email)
  ) or exists (
    select 1 from public.profiles p where lower(trim(p.email)) = p_email
  ) or exists (
    select 1 from auth.users u where lower(trim(u.email)) = p_email
  ) or exists (
    select 1 from public.coaches k where lower(trim(k.email)) = p_email
      or exists (select 1 from unnest(k.alternate_emails) e where lower(trim(e)) = p_email)
  ) or split_part(p_email, '@', 2) in ('joinaceleratalent.com', 'fathom.video') then
    return null;
  end if;

  perform 1 from public.calls c where c.fathom_call_id = any(p_recordings) order by c.id for update;
  select count(*), min((c.started_at at time zone 'America/Bogota')::date)
    into v_count, v_day
  from public.calls c where c.fathom_call_id = any(p_recordings) and c.source = 'fathom'
    and c.client_id is null and c.started_at <= now()
    and c.raw_metadata->>'internal_call' is distinct from 'true';
  if v_count <> cardinality(p_recordings) or not exists (
    select 1 from public.calls c
    cross join lateral jsonb_array_elements(case when jsonb_typeof(c.raw_metadata->'external_invitees') = 'array'
      then c.raw_metadata->'external_invitees' else '[]'::jsonb end) i
    where c.fathom_call_id = any(p_recordings) and lower(trim(i->>'email')) = p_email
      and c.title ~* '^ *(at +)?on[ -]?boarding'
  ) then
    return null;
  end if;
  if p_primary_recording is not null then
    select * into v_primary from public.calls c where c.fathom_call_id = p_primary_recording
      and c.fathom_call_id = any(p_recordings) and not c.coach_needs_confirmation
      and c.coach_resolution in ('recorded_by', 'participant')
      and exists (select 1 from public.coaches k where k.id = c.coach_id and k.is_active and k.bills_by_call);
    if not found then return null; end if;
  end if;

  -- The detected address matches future calls but is not an account credential.
  insert into public.clients (full_name, onboarding_email, alternate_emails, start_date, end_date)
  values (p_name, p_email, array[p_email], v_day, (v_day + interval '3 months')::date)
  returning id into v_client;

  update public.calls set client_id = v_client, client_match_method = 'manual',
    raw_metadata = raw_metadata || jsonb_build_object('client_match_reason', 'onboarding_intake')
  where fathom_call_id = any(p_recordings);
  if v_primary.id is not null then
    insert into public.coach_client_assignments (coach_id, client_id, is_primary)
    values (v_primary.coach_id, v_client, true);
    -- Only explicit, near-identical recordings of the selected session are hidden.
    update public.calls c set raw_metadata = c.raw_metadata ||
      jsonb_build_object('onboarding_duplicate_of', v_primary.id)
    where c.fathom_call_id = any(p_recordings) and c.id <> v_primary.id
      and c.coach_id is distinct from v_primary.coach_id
      and abs(extract(epoch from (c.started_at - v_primary.started_at))) <= 180
      and abs(c.duration_seconds - v_primary.duration_seconds) <= 180;
  end if;
  return v_client;
end;
$$;

revoke all on function public.create_client_from_onboarding(text, text, text[], text) from public, anon, authenticated;
grant execute on function public.create_client_from_onboarding(text, text, text[], text) to service_role;

create or replace view public.client_sessions with (security_invoker = true) as
  select original.id, original.client_id, original.coach_id, original.source, original.fathom_call_id,
    original.title, original.started_at, original.duration_seconds, original.summary, original.next_steps,
    original.recording_url, original.share_url, original.calendar_event_id, original.raw_metadata,
    original.created_at, original.updated_at, original.display_title, original.display_title_generated_at
  from public.calls original
  join (
    select id, row_number() over (
      partition by client_id, started_at, lower(trim(title)),
        case when source <> 'fathom' or client_id is null or started_at is null
          or coach_id is null or nullif(trim(title), '') is null
          or not exists (
            select 1 from public.calls other
            where other.source = 'fathom' and other.client_id = candidate.client_id
              and other.started_at = candidate.started_at
              and lower(trim(other.title)) = lower(trim(candidate.title))
              and other.coach_id <> candidate.coach_id
          ) then id else null end
      order by (nullif(trim(summary), '') is not null) desc,
        (coalesce(nullif(trim(share_url), ''), nullif(trim(recording_url), '')) is not null) desc,
        created_at asc, id asc
    ) as session_rank
    from public.calls candidate
    where not exists (
      select 1 from public.calls primary_call
      where primary_call.id::text = candidate.raw_metadata->>'onboarding_duplicate_of'
        and primary_call.client_id = candidate.client_id and primary_call.id <> candidate.id
    )
  ) ranked on ranked.id = original.id and ranked.session_rank = 1;

commit;
notify pgrst, 'reload schema';
