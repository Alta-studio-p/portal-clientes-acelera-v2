import { identifyOnboardingCandidates } from '../lib/onboarding-candidates.mjs';
import { createSqlClient } from '../lib/postgres.mjs';

const days = Number(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1] ?? 14);
if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Usa --days=1 a --days=90.');

const sql = createSqlClient();
try {
  const calls = await sql`
    select c.fathom_call_id, c.title, c.client_id, c.started_at,
      (c.started_at at time zone 'America/Bogota')::date as day,
      left(c.summary, 600) as summary, k.full_name as coach,
      jsonb_build_object('external_invitees', c.raw_metadata->'external_invitees',
        'internal_call', c.raw_metadata->'internal_call') as raw_metadata
    from public.calls c left join public.coaches k on k.id = c.coach_id
    where c.source = 'fathom' and c.started_at between now() - make_interval(days => ${days}::int) and now()
      and c.title ~* '^ *(at +)?on[ -]?boarding'
    order by c.started_at desc, c.fathom_call_id
  `;
  const clients = await sql`select id, full_name, email, alternate_emails from public.clients`;
  const staff = await sql`
    select email from public.coaches
    union select unnest(alternate_emails) from public.coaches
    union select email from public.profiles where role <> 'client'
  `;
  const audit = identifyOnboardingCandidates(calls, clients, staff.map(row => row.email));
  const showEmails = process.argv.includes('--show-emails');
  console.log(JSON.stringify({
    days,
    callsReviewed: calls.length,
    ...audit,
    candidates: audit.candidates.map(({ email, ...candidate }) => showEmails ? { ...candidate, email } : candidate),
  }, null, 2));
} finally {
  await sql.end();
}
