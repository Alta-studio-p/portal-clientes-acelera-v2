import { createHash, randomBytes } from 'node:crypto';

const digest = token => createHash('sha256').update(token).digest('hex');
const invalid = () => ({ error: 'El enlace venció, ya fue utilizado o no es válido. Solicita uno nuevo a Acelera.' });

// This internal helper requires a server-side SQL client. Callers authorize the admin.
export async function issueClientInvitation(sql, { clientId, profileId, email, origin, createdBy }) {
  const url = new URL('/auth/invitation', origin);
  if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|\[::1\])/.test(url.hostname)) throw Error('missing_origin');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = await sql.transaction(async tx => {
    const [client] = await tx`select c.id from public.clients c join public.profiles p on p.id=c.profile_id
      where c.id=${clientId}::uuid and c.profile_id=${profileId}::uuid
      and lower(trim(c.email))=${email} and lower(p.email)=${email} and p.role='client'
      and not exists (select 1 from public.coaches co where co.profile_id=p.id or lower(co.email)=${email})
      for update of c`;
    if (!client) throw Error('client_identity_conflict');
    await tx`update public.client_access_invitations set used_at=now() where client_id=${clientId}::uuid and used_at is null`;
    const [invitation] = await tx`insert into public.client_access_invitations (client_id,profile_id,email,token_hash,created_by)
      values (${clientId}::uuid,${profileId}::uuid,${email},${digest(token)},${createdBy}::uuid) returning expires_at::text`;
    return invitation.expires_at;
  });
  url.hash = new URLSearchParams({ token }).toString();
  return { link: url.toString(), expiresAt };
}

export async function redeemClientInvitation(sql, token, { createAdminClient, createClient }) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return invalid();
  return sql.transaction(async tx => {
    const [invite] = await tx`select i.id,i.profile_id::text,i.email
      from public.client_access_invitations i
      join public.clients c on c.id=i.client_id and c.profile_id=i.profile_id
      join public.profiles p on p.id=i.profile_id
      where i.token_hash=${digest(token)} and i.used_at is null and i.expires_at>now()
      and lower(trim(c.email))=i.email and lower(p.email)=i.email and p.role='client'
      and not exists (select 1 from public.coaches co where co.profile_id=p.id or lower(co.email)=i.email)
      for update of i`;
    if (!invite) return invalid();
    const admin = await createAdminClient();
    const account = await admin.auth.admin.getUserById(invite.profile_id);
    if (account.error || !account.data.user || account.data.user.email?.toLowerCase() !== invite.email) return invalid();
    const type = account.data.user.email_confirmed_at ? 'recovery' : 'invite';
    // The short-lived Supabase token is minted only when the recipient accepts.
    const generated = await admin.auth.admin.generateLink({ type, email: invite.email });
    if (generated.error || generated.data.user?.id !== invite.profile_id || !generated.data.properties?.hashed_token) return invalid();
    const supabase = await createClient();
    const verified = await supabase.auth.verifyOtp({ token_hash: generated.data.properties.hashed_token, type });
    if (verified.error || verified.data.user?.id !== invite.profile_id) return invalid();
    await tx`update public.client_access_invitations set used_at=now() where id=${invite.id}::uuid`;
    return { error: null };
  });
}
