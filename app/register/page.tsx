import { RegistrationForm } from './registration-form';

export const metadata = { title: 'Crear cuenta | Acelera Talent', robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <main className="flex flex-1 items-center justify-center px-4 py-16">
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="Acelera Talent" className="mx-auto mb-4 h-10 w-10 object-contain" />
        <h1 className="text-xl font-semibold">Crea tu cuenta</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Usa el correo de tu ficha de cliente y elige tu contraseña para ingresar.</p>
      </div>
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm"><RegistrationForm /></div>
      <p className="mt-6 text-center text-xs leading-5 text-muted">¿Tu correo cambió? Contacta a admin@joinaceleratalent.com</p>
    </div>
  </main>;
}
