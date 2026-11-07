import 'server-only';
import { getSql } from '@/lib/db';

export async function completePendingInvitation(userId: string, clientId: string, email: string, password: string) {
  const sql = getSql();
  // Compare-and-set under PostgreSQL's row lock: an Auth API read followed by
  // updateUserById could overwrite a password set concurrently through recovery.
  // Only a never-used, passwordless invitation tied to the same client address
  // can be claimed. Lock the client before promoting a pending onboarding.
  const rows = await sql`
    with eligible as (
      select c.id from public.clients c join public.profiles p on p.id = ${userId}::uuid
      where c.id = ${clientId}::uuid and p.role = 'client' and lower(trim(p.email)) = ${email}
        and ((c.profile_id = p.id and lower(trim(c.email)) = ${email})
          or (c.profile_id is null and c.email is null and lower(trim(c.onboarding_email)) = ${email}))
        and not exists (
          select 1 from public.clients other where other.id <> c.id
            and (other.profile_id = p.id or lower(trim(other.email)) = ${email}
              or lower(trim(other.onboarding_email)) = ${email}
              or exists (select 1 from unnest(other.alternate_emails) e where lower(trim(e)) = ${email}))
        )
        and not exists (
          select 1 from public.coaches where profile_id = p.id or lower(trim(email)) = ${email}
            or exists (select 1 from unnest(alternate_emails) e where lower(trim(e)) = ${email})
        )
        and not exists (select 1 from public.profiles where lower(trim(email)) = ${email} and id <> p.id)
      for update of c
    ), claimed as (
      update auth.users u set
        encrypted_password = extensions.crypt(${password}, extensions.gen_salt('bf', 10)),
        email_confirmed_at = now(), updated_at = now(),
        confirmation_token = '', recovery_token = '',
        raw_user_meta_data = jsonb_set(coalesce(u.raw_user_meta_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb)
      from eligible
      where u.id = ${userId}::uuid and lower(trim(u.email)) = ${email}
        and u.invited_at is not null and u.email_confirmed_at is null
        and u.last_sign_in_at is null and coalesce(u.encrypted_password, '') = ''
        and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
        and not u.is_sso_user and not u.is_anonymous
        and exists (select 1 from auth.identities where user_id = u.id and provider = 'email')
      returning u.id
    ), identities as (
      update auth.identities i set
        identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb),
        updated_at = now()
      from claimed where i.user_id = claimed.id and i.provider = 'email'
      returning i.user_id
    )
    update public.clients c set profile_id = claimed.id, email = coalesce(c.email, ${email}), updated_at = now()
    from eligible, claimed join identities on identities.user_id = claimed.id
    where c.id = eligible.id returning c.id
  `;
  return rows.length > 0;
}
