'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getClientByProfileId } from '@/lib/data/client-detail';
import { createClient } from '@/lib/supabase/server';

export async function setClientPassword(_previous: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const { userId } = await requireRole(['client']);
  if (!await getClientByProfileId(userId)) return { error: 'Tu acceso aún no está vinculado. Contacta a Acelera.' };
  const password = String(form.get('password') ?? '');
  if (password.length < 10 || password.length > 128) return { error: 'Usa una contraseña de entre 10 y 128 caracteres.' };
  if (password !== String(form.get('confirmPassword') ?? '')) return { error: 'Las contraseñas no coinciden.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'No se pudo guardar. Usa otra contraseña o solicita un enlace nuevo.' };
  redirect('/portal');
}
