'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/server';

export interface InviteState { error: string | null; message: string | null }

async function activationUrl() {
  const origin = (await headers()).get('origin');
  if (process.env.NODE_ENV === 'development' && origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    return `${origin}/auth/activate`;
  }
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  if (!configured) throw new Error('missing_origin');
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('missing_origin');
  return `${url.origin}/auth/activate`;
}

export async function inviteClient(_previous: InviteState, form: FormData): Promise<InviteState> {
  await requireRole(['admin']);
  const clientId = String(form.get('clientId') ?? '');
  const fail = (error: string): InviteState => ({ error, message: null });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) return fail('Cliente no válido.');
  let invitationSent = false;
  try {
    const sql = getSql();
    const [client] = await sql`select id::text, profile_id::text, email, full_name from public.clients where id = ${clientId}::uuid`;
    if (!client) return fail('No se encontró el cliente.');
    const email = String(client.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('La ficha necesita un correo válido antes de invitar al cliente.');
    if (email !== String(form.get('email') ?? '').trim().toLowerCase()) return fail('El correo cambió. Recarga la ficha antes de invitar.');
    const conflicts = await sql`
      select id from public.profiles where lower(email) = ${email} and role <> 'client'
      union all select id from public.coaches where lower(email) = ${email}
      union all select id from public.clients where lower(trim(email)) = ${email} and id <> ${clientId}::uuid
    `;
    if (conflicts.length) return fail('Ese correo pertenece a otra ficha o a una cuenta del equipo. No se cambió su acceso.');
    const redirectTo = await activationUrl();
    const admin = await createAdminClient();
    let user: Awaited<ReturnType<typeof admin.auth.admin.listUsers>>['data']['users'][number] | undefined;
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return fail('No se pudo consultar las cuentas de Supabase. Revisa la clave privada del servidor.');
      user = data.users.find(u => u.email?.toLowerCase() === email);
      if (user || data.users.length < 1000) break;
    }
    if (client.profile_id && client.profile_id !== user?.id) return fail('La ficha ya está vinculada a otra cuenta. Revisa el acceso antes de continuar.');
    if (user) {
      const [profile] = await sql`select role, email from public.profiles where id = ${user.id}::uuid`;
      if ((profile && (profile.role !== 'client' || String(profile.email).toLowerCase() !== email)) || (!profile && user.email_confirmed_at)) {
        return fail('Ya existe una cuenta con ese correo y no está validada como cliente. No se modificó.');
      }
      const linked = await sql`
        select id from public.clients where profile_id = ${user.id}::uuid and id <> ${clientId}::uuid
        union all select id from public.coaches where profile_id = ${user.id}::uuid
      `;
      if (linked.length) return fail('Esta cuenta ya está vinculada a otra persona.');
    }
    if (!user) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: client.full_name } });
      if (error || !data.user) return fail('Supabase no pudo enviar la invitación. Revisa SMTP, límites de envío y las URLs permitidas.');
      user = data.user;
      invitationSent = true;
    }
    // Lock the client row and bind only an unassigned or identical client profile.
    const linked = await sql`
      with eligible as (
        select id from public.clients where id = ${clientId}::uuid
          and lower(trim(email)) = ${email} and (profile_id is null or profile_id = ${user.id}::uuid)
          and not exists (select 1 from public.clients where profile_id = ${user.id}::uuid and id <> ${clientId}::uuid)
          and not exists (select 1 from public.coaches where profile_id = ${user.id}::uuid)
        for update
      ), profile as (
        insert into public.profiles (id, email, full_name, role)
        select ${user.id}::uuid, ${email}, ${client.full_name}, 'client' from eligible
        on conflict (id) do update set updated_at = now()
          where profiles.role = 'client' and lower(profiles.email) = ${email}
        returning id
      )
      update public.clients set profile_id = profile.id, updated_at = now()
      from profile, eligible where clients.id = eligible.id returning clients.id
    `;
    if (!linked.length) return fail('No se pudo vincular la cuenta. Recarga y revisa si la ficha tiene otro acceso.');
    revalidatePath(`/admin/clients/${clientId}`);
    if (!invitationSent) {
      // Existing accounts get a password-creation/reset link, not a duplicate account.
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return fail('El acceso quedó vinculado, pero no se pudo enviar el enlace. Intenta reenviarlo o revisa SMTP.');
    }
    return { error: null, message: 'Enlace enviado. El cliente podrá crear su contraseña y acceder a su página.' };
  } catch (error) {
    if (error instanceof Error && error.message === 'missing_origin') return fail('Configura APP_URL con la dirección pública del portal antes de enviar invitaciones.');
    return fail(invitationSent ? 'La invitación se envió, pero no se completó la vinculación. Reintenta desde esta ficha antes de que el cliente entre.' : 'No se pudo completar la invitación. No se cambiaron permisos de otras cuentas.');
  }
}
