// Keep account-specific recordings for billing/auditing, but count shared
// Fathom recordings as one client session only with exact identity evidence.
export const CLIENT_SESSIONS_QUERY = `
  select original.*
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
      order by
        (nullif(trim(summary), '') is not null) desc,
        (coalesce(nullif(trim(share_url), ''), nullif(trim(recording_url), '')) is not null) desc,
        created_at asc, id asc
    ) as session_rank
    from public.calls candidate
  ) ranked on ranked.id = original.id and ranked.session_rank = 1
`;

export const CLIENT_SESSIONS_VIEW_SQL =
  `create or replace view public.client_sessions as ${CLIENT_SESSIONS_QUERY}`;
