'use server';

import { redirect } from 'next/navigation';
import { getSessionProfile, roleHome } from '@/lib/auth';
import { claimOnboardingClient } from '@/lib/data/claim-onboarding-client';
import { getClientByProfileId } from '@/lib/data/client-detail';
import { createClient } from '@/lib/supabase/server';

// Used both for client invites and for "forgot password" recovery links
// across all roles — the client-row check only applies to clients, since
// admin/coach accounts don't have one.
export async function setNewPassword(_previous: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const password = String(form.get('password') ?? '');
  if (password.length < 10 || password.length > 128) return { error: 'Usa una contraseña de entre 10 y 128 caracteres.' };
  if (Buffer.byteLength(password, 'utf8') > 72) return { error: 'La contraseña es demasiado larga. Usa una más corta.' };
  if (password !== String(form.get('confirmPassword') ?? '')) return { error: 'Las contraseñas no coinciden.' };
  const session = await getSessionProfile();
  if (!session) return { error: 'El enlace no es válido. Solicita uno nuevo.' };
  const { userId, profile, email } = session;
  if (!profile || (profile.role === 'client' && !await getClientByProfileId(userId))) {
    try {
      if (!email || !await claimOnboardingClient(userId, email.trim().toLowerCase())) {
        return { error: 'Tu acceso aún no está vinculado. Contacta a Acelera.' };
      }
    } catch {
      return { error: 'No se pudo vincular tu acceso. Intenta de nuevo.' };
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'No se pudo guardar. Usa otra contraseña o solicita un enlace nuevo.' };
  redirect(roleHome(profile?.role ?? 'client'));
}
