"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth";

export type LoginState = { error: string | null };

const DEFAULT_LOGIN_DOMAIN = "joinaceleratalent.com";

// Los accesos son por usuario simple ("alex", "admin"), sin arroba. Por
// debajo Supabase Auth sigue identificando cuentas por email, así que un
// usuario sin "@" se completa con el dominio por defecto. Si el usuario ya
// escribe un correo completo (cuentas viejas como outlook.com) se respeta tal
// cual, para no romper accesos existentes.
function resolveLoginEmail(usernameOrEmail: string): string {
  if (usernameOrEmail.includes("@")) return usernameOrEmail;
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
    return { error: "Usuario o contraseña incorrectos." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    return {
      error:
        "Tu cuenta no tiene un perfil asociado todavía. Contacta a Acelera para vincular tu acceso.",
    };
  }

  const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : roleHome(profile.role);
  redirect(target);
}
