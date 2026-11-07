import 'server-only';

import { getSql } from '@/lib/db';

export async function claimOnboardingClient(userId: string, email: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    with eligible as (
      select c.id, c.full_name
      from public.clients c join auth.users u on u.id = ${userId}::uuid
      where c.profile_id is null and c.email is null and lower(trim(c.onboarding_email)) = ${email}
        and lower(trim(u.email)) = ${email} and u.email_confirmed_at is not null
        and split_part(${email}, '@', 2) <> 'joinaceleratalent.com'
        and not exists (
          select 1 from public.clients other where other.id <> c.id and
            (other.profile_id = u.id or lower(trim(other.email)) = ${email}
              or exists (select 1 from unnest(other.alternate_emails) e where lower(trim(e)) = ${email}))
        )
        and not exists (
          select 1 from public.profiles p
          where (p.id = u.id or lower(trim(p.email)) = ${email})
            and (p.id <> u.id or p.role <> 'client' or lower(trim(p.email)) is distinct from ${email})
        )
        and not exists (
          select 1 from public.coaches k where k.profile_id = u.id or lower(trim(k.email)) = ${email}
            or exists (select 1 from unnest(k.alternate_emails) e where lower(trim(e)) = ${email})
        )
      for update of c
    ), profile as (
      insert into public.profiles (id, email, full_name, role)
      select ${userId}::uuid, ${email}, full_name, 'client' from eligible
      on conflict (id) do update set updated_at = now()
        where profiles.role = 'client' and lower(trim(profiles.email)) = ${email}
      returning id
    )
    update public.clients c set profile_id = profile.id, email = ${email}, updated_at = now()
    from eligible, profile where c.id = eligible.id returning c.id
  `;
  return rows.length === 1;
}
