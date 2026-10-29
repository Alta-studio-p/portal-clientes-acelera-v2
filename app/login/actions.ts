"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSql } from "@/lib/db";
import { loginDestination } from "@/lib/login-destination";
import type { Profile } from "@/lib/supabase/types";

export type LoginState = { error: string | null };

const DEFAULT_LOGIN_DOMAIN = "joinaceleratalent.com";

// Los accesos son por usuario simple ("alex", "admin"), sin arroba. Por
// debajo Supabase Auth sigue identificando cuentas por email, así que un
// usuario sin "@" se completa con el dominio por defecto. Si el usuario ya
// escribe un correo completo (cuentas viejas como outlook.com) se respeta tal
// cual, para no romper accesos existentes.
function resolveLoginEmail(usernameOrEmail: string): string {
  if (usernameOrEmail.includes("@")) return usernameOrEmail.toLowerCase();
  return `${usernameOrEmail.toLowerCase()}@${DEFAULT_LOGIN_DOMAIN}`;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "");

  if (!username || !password) {
    return { error: "Ingresa tu usuario y contraseña." };
  }

  const email = resolveLoginEmail(username);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (error?.code === 'email_not_confirmed') return { error: 'Tu acceso anterior quedó pendiente. Usa “Olvidé mi contraseña” para activarlo.' };
    if (error?.status === 429) return { error: 'Demasiados intentos. Espera unos minutos antes de volver a ingresar.' };
    if (error && (error.status === 0 || (error.status ?? 0) >= 500)) return { error: 'El servicio de acceso no está disponible por el momento. Intenta de nuevo en unos minutos.' };
    return { error: 'Correo o contraseña incorrectos. Usa tu correo completo o recupera tu contraseña.' };
  }

  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut({ scope: 'local' });
    return { error: 'Tu acceso anterior quedó pendiente. Usa “Olvidé mi contraseña” para activarlo.' };
  }

  const sql = getSql();
  const profiles = await sql`
    select id::text, email, full_name, role
    from public.profiles
    where id = ${data.user.id}::uuid
    limit 1
  `;
  const profile = profiles[0] as unknown as Profile | undefined;

  if (!profile) {
    await supabase.auth.signOut({ scope: 'local' });
    return {
      error:
        "Tu cuenta no tiene un perfil asociado todavía. Contacta a Acelera para vincular tu acceso.",
    };
  }

  const target = loginDestination(redirectTo, profile.role);
  redirect(target);
}
