'use server';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSql } from '@/lib/db';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export interface RegistrationState { error: string | null; message: string | null }
const unavailable = 'No pudimos crear la cuenta con ese correo. Si ya tienes cuenta, inicia sesión o usa “Olvidé mi contraseña”. Si eres cliente nuevo, contacta a Acelera para revisar tu correo registrado.';

export async function requestClientRegistration(_previous: RegistrationState, form: FormData): Promise<RegistrationState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Escribe un correo válido.', message: null };
  }
  if (password.length < 10 || password.length > 128) return { error: 'Usa una contraseña de entre 10 y 128 caracteres.', message: null };
  if (password !== String(form.get('confirmPassword') ?? '')) return { error: 'Las contraseñas no coinciden.', message: null };
  try {
    const sql = getSql();
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw new Error('registration_unavailable');
    const requestHeaders = await headers();
    // Vercel overwrites this header; do not trust an arbitrary forwarded-for header.
    const ip = process.env.VERCEL ? requestHeaders.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : 'local';
    const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
    const limits = await sql`
      insert into private.client_registration_limits (key, window_start, attempts)
      values (${hash('email:' + email)}, date_trunc('hour', now()), 1),
        (${hash('ip:' + (ip ?? 'unknown'))}, date_trunc('hour', now()), 1)
      on conflict (key) do update set
        attempts = case when client_registration_limits.window_start = excluded.window_start
          then client_registration_limits.attempts + 1 else 1 end,
        window_start = excluded.window_start
      returning key, attempts
    `;
    if (limits.some(row => Number(row.attempts) > (row.key === hash('email:' + email) ? 3 : 15))) {
      return { error: 'Demasiados intentos. Intenta más tarde.', message: null };
    }
    const clients = await sql`select id::text, profile_id::text, email, full_name from public.clients where lower(trim(email)) = ${email}`;
    if (clients.length !== 1) return { error: unavailable, message: null };
    const client = clients[0];
    const conflicts = await sql`
      select id from public.profiles where lower(trim(email)) = ${email} and role <> 'client'
      union all select id from public.coaches where lower(trim(email)) = ${email}
    `;
    if (conflicts.length || client.profile_id) return { error: unavailable, message: null };
    const admin = await createAdminClient();
    let user: Awaited<ReturnType<typeof admin.auth.admin.listUsers>>['data']['users'][number] | undefined;
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error('auth_lookup_failed');
      user = data.users.find(item => item.email?.trim().toLowerCase() === email);
      if (user || data.users.length < 1000) break;
    }
    // Existing identities, including pending invites, must recover their password.
    // Never overwrite an existing password based only on knowledge of an email.
    if (user) return { error: unavailable, message: null };
    const { data, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError || !data.user || data.user.email?.toLowerCase() !== email) return { error: unavailable, message: null };
    user = data.user;
    const linked = await sql`
      with eligible as (
        select id from public.clients where id = ${client.id}::uuid
          and lower(trim(email)) = ${email} and (profile_id is null or profile_id = ${user.id}::uuid)
          and (select count(*) from public.clients where lower(trim(email)) = ${email}) = 1
          and not exists (select 1 from public.clients where profile_id = ${user.id}::uuid and id <> ${client.id}::uuid)
          and not exists (select 1 from public.coaches where profile_id = ${user.id}::uuid or lower(trim(email)) = ${email})
          and not exists (select 1 from public.profiles where lower(trim(email)) = ${email} and role <> 'client')
        for update
      ), profile as (
        insert into public.profiles (id, email, full_name, role)
        select ${user.id}::uuid, ${email}, ${client.full_name}, 'client' from eligible
        on conflict (id) do update set updated_at = now()
          where profiles.role = 'client' and lower(trim(profiles.email)) = ${email}
        returning id
      )
      update public.clients set profile_id = profile.id, updated_at = now()
      from profile, eligible where clients.id = eligible.id returning clients.id
    `;
    if (!linked.length) return { error: unavailable, message: null };
  } catch {
    console.error('Client registration could not complete.');
    return { error: 'No pudimos procesar la solicitud. Intenta más tarde o contacta a Acelera.', message: null };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'La cuenta fue creada. Inicia sesión con tu correo y contraseña.', message: null };
  redirect('/portal');
}
