import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Acelera Talent" className="mx-auto mb-4 h-10 w-10 object-contain" />
          <h1 className="text-lg font-semibold text-foreground">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-muted">Ingresa tu usuario o correo y te enviaremos un enlace.</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <ForgotPasswordForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted-2">
          ¿Problemas para entrar? Escribe a admin@joinaceleratalent.com
        </p>
      </div>
    </div>
  );
}
