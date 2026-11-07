'use server';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { getActivationUrl } from '@/lib/activation-url';
import { getSql } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/server';
import type { RegistrationState } from './actions';

const accepted = {
  error: null,
  message: 'Si el correo coincide con tu ficha de onboarding, recibirás un enlace para crear tu contraseña. Revisa también el correo no deseado.',
};

export async function requestOnboardingAccess(_previous: RegistrationState, form: FormData): Promise<RegistrationState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Escribe un correo válido.', message: null };
  }
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw new Error('missing_auth_secret');
    const ip = process.env.VERCEL ? (await headers()).get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : 'local';
    const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
    const emailKey = hash('onboarding-email:' + email);
    const ipKey = hash('onboarding-ip:' + (ip || 'unknown'));
    const sql = getSql();
    const limits = await sql`
      insert into private.client_registration_limits (key, window_start, attempts)
      values (${emailKey}, date_trunc('hour', now()), 1), (${ipKey}, date_trunc('hour', now()), 1)
      on conflict (key) do update set
        attempts = case when client_registration_limits.window_start = excluded.window_start
          then client_registration_limits.attempts + 1 else 1 end,
        window_start = excluded.window_start
      returning key, attempts
    `;
    if (email.endsWith('@joinaceleratalent.com') || limits.some(row => Number(row.attempts) > (row.key === emailKey ? 3 : 15))) return accepted;
    const [eligible] = await sql`
      select c.full_name, u.email_confirmed_at as confirmed
      from public.clients c left join auth.users u on lower(trim(u.email)) = ${email}
      where c.profile_id is null and c.email is null and lower(trim(c.onboarding_email)) = ${email}
        and not exists (
          select 1 from public.clients other where other.id <> c.id and
            (lower(trim(other.email)) = ${email}
              or exists (select 1 from unnest(other.alternate_emails) e where lower(trim(e)) = ${email}))
        )
        and not exists (
          select 1 from public.profiles p
          where (p.id = u.id or lower(trim(p.email)) = ${email})
            and (p.id is distinct from u.id or p.role <> 'client' or lower(trim(p.email)) is distinct from ${email})
        )
        and not exists (
          select 1 from public.coaches k where k.profile_id = u.id or lower(trim(k.email)) = ${email}
            or exists (select 1 from unnest(k.alternate_emails) e where lower(trim(e)) = ${email})
        )
    `;
    if (!eligible) return accepted;
    const redirectTo = await getActivationUrl(true);
    const admin = await createAdminClient();
    const result = eligible.confirmed
      ? await admin.auth.resetPasswordForEmail(email, { redirectTo })
      : await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: eligible.full_name } });
    if (result.error) console.error('Self-service onboarding email could not be sent.', result.error.code);
  } catch {
    console.error('Self-service onboarding could not complete.');
  }
  return accepted;
}
