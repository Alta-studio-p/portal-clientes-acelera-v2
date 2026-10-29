'use server';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { getSql } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/server';
import { getActivationUrl } from '@/lib/activation-url';

export type ForgotPasswordState = { error: string | null; message: string | null };

const DEFAULT_LOGIN_DOMAIN = 'joinaceleratalent.com';

function resolveLoginEmail(usernameOrEmail: string): string {
  if (usernameOrEmail.includes('@')) return usernameOrEmail;
  return `${usernameOrEmail.toLowerCase()}@${DEFAULT_LOGIN_DOMAIN}`;
}

// Always returns the same message regardless of whether the account exists,
// to avoid leaking which usernames/emails are registered.
const GENERIC_MESSAGE = 'Si existe una cuenta con ese usuario, enviamos un enlace para restablecer la contraseña.';

export async function forgotPasswordAction(
  _previous: ForgotPasswordState,
  form: FormData
): Promise<ForgotPasswordState> {
  const username = String(form.get('email') ?? '').trim().toLowerCase();
  if (!username) return { error: 'Ingresa tu usuario o correo.', message: null };

  const email = resolveLoginEmail(username);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Ingresa un correo válido.', message: null };
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw new Error('recovery_unavailable');
    const requestHeaders = await headers();
    const ip = process.env.VERCEL ? requestHeaders.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : 'local';
    const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
    const sql = getSql();
    const limits = await sql`
      insert into private.client_registration_limits (key, window_start, attempts)
      values (${hash('recovery-email:' + email)}, date_trunc('hour', now()), 1),
        (${hash('recovery-ip:' + (ip ?? 'unknown'))}, date_trunc('hour', now()), 1)
      on conflict (key) do update set
        attempts = case when client_registration_limits.window_start = excluded.window_start
          then client_registration_limits.attempts + 1 else 1 end,
        window_start = excluded.window_start
      returning key, attempts
    `;
    if (limits.some(row => Number(row.attempts) > (row.key === hash('recovery-email:' + email) ? 3 : 15))) return { error: null, message: GENERIC_MESSAGE };
    const redirectTo = await getActivationUrl(true);
    // Implicit recovery links also work when opened in a different browser.
    const supabase = await createAdminClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // Swallow config/send errors here too — same generic message either way.
  }

  return { error: null, message: GENERIC_MESSAGE };
}
