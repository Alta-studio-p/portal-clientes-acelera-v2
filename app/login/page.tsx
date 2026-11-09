import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { loginDestination } from '@/lib/login-destination';
import { LoginForm } from "./login-form";
import { AuthFrame } from '@/components/auth-frame';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const session = await getSessionProfile();
  const params = await searchParams;

  if (session?.profile) {
    redirect(loginDestination(params.redirectTo, session.profile.role));
  }

  return (
    <AuthFrame title="Portal Clientes Acelera" description="Acceso privado de coaching" footer="¿Problemas para entrar? Escribe a admin@joinaceleratalent.com">
          <LoginForm redirectTo={params.redirectTo} />
          <p className="mt-5 text-center text-sm text-muted">¿Primera vez aquí? <Link href="/register" className="text-accent hover:underline">Crear cuenta de cliente</Link></p>
          {params.error === "no_profile" && (
            <p className="mt-4 rounded-md bg-[--danger-bg] px-3 py-2 text-xs text-[--danger]">
              Tu cuenta no tiene un perfil asociado. Contacta a Acelera.
            </p>
          )}
    </AuthFrame>
  );
}
