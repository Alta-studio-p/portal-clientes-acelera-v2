'use server';

import { redirect } from 'next/navigation';
import { getSql } from '@/lib/db';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { redeemClientInvitation } from '@/lib/client-invitation.mjs';

export async function acceptInvitation(_previous: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  try {
    const result = await redeemClientInvitation(getSql(), String(form.get('token') ?? ''), { createAdminClient, createClient });
    if (result.error) return result;
  } catch {
    return { error: 'No se pudo activar el acceso. Intenta nuevamente o solicita un enlace nuevo.' };
  }
  redirect('/auth/activate');
}
