import { redirect } from "next/navigation";
import { getSessionProfile, roleHome } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const session = await getSessionProfile();
  const params = await searchParams;

  if (session?.profile) {
    redirect(params.redirectTo && params.redirectTo.startsWith("/") ? params.redirectTo : roleHome(session.profile.role));
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white">
            A
          </div>
          <h1 className="text-lg font-semibold text-foreground">Portal Clientes Acelera</h1>
          <p className="mt-1 text-sm text-muted">Acceso privado de coaching</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <LoginForm redirectTo={params.redirectTo} />
          {params.error === "no_profile" && (
            <p className="mt-4 rounded-md bg-[--danger-bg] px-3 py-2 text-xs text-[--danger]">
              Tu cuenta no tiene un perfil asociado. Contacta a Acelera.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-2">
          ¿Problemas para entrar? Escribe a admin@joinaceleratalent.com
        </p>
      </div>
    </div>
  );
}
