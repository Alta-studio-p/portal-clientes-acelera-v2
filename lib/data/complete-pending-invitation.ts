import 'server-only';
import { getSql } from '@/lib/db';

export async function completePendingInvitation(userId: string, clientId: string, email: string, password: string) {
  const sql = getSql();
  // Compare-and-set under PostgreSQL's row lock: an Auth API read followed by
  // updateUserById could overwrite a password set concurrently through recovery.
  // Only a never-used, passwordless invitation with its original client binding
  // can be claimed. Bcrypt is the password format accepted by Supabase Auth.
  const rows = await sql`
    with claimed as (
      update auth.users u set
        encrypted_password = extensions.crypt(${password}, extensions.gen_salt('bf', 10)),
        email_confirmed_at = now(), updated_at = now(),
        confirmation_token = '', recovery_token = '',
        raw_user_meta_data = jsonb_set(coalesce(u.raw_user_meta_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb)
      from public.clients c join public.profiles p on p.id = c.profile_id
      where u.id = ${userId}::uuid and c.id = ${clientId}::uuid and c.profile_id = u.id
        and p.role = 'client' and lower(trim(p.email)) = ${email}
        and lower(trim(c.email)) = ${email} and lower(trim(u.email)) = ${email}
        and u.invited_at is not null and u.email_confirmed_at is null
        and u.last_sign_in_at is null and coalesce(u.encrypted_password, '') = ''
        and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
        and not u.is_sso_user and not u.is_anonymous
        and (select count(*) from public.clients where lower(trim(email)) = ${email}) = 1
        and (select count(*) from public.clients where profile_id = u.id) = 1
        and not exists (select 1 from public.coaches where profile_id = u.id or lower(trim(email)) = ${email})
        and not exists (select 1 from public.profiles where lower(trim(email)) = ${email} and id <> u.id)
        and exists (select 1 from auth.identities where user_id = u.id and provider = 'email')
      returning u.id
    ), identities as (
      update auth.identities i set
        identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb),
        updated_at = now()
      from claimed where i.user_id = claimed.id and i.provider = 'email'
      returning i.user_id
    )
    select claimed.id::text from claimed join identities on identities.user_id = claimed.id
  `;
  return rows.length > 0;
}
