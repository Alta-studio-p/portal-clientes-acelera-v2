'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestClientRegistration, type RegistrationState } from './actions';

const initial: RegistrationState = { error: null, message: null };

export function RegistrationForm() {
  const [state, action, pending] = useActionState(requestClientRegistration, initial);
  return <form action={action} className="space-y-5">
    <div>
      <label htmlFor="registration-email" className="mb-2 block text-sm font-medium">Correo registrado en Acelera</label>
      <input id="registration-email" name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false}
        className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
    </div>
    <label className="block text-sm font-medium" htmlFor="registration-password">Contraseña
      <input id="registration-password" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" disabled={pending}
        className="mt-2 min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:ring-2 focus:ring-accent/20" />
      <span className="mt-1 block text-xs font-normal text-muted">Mínimo 10 caracteres.</span>
    </label>
    <label className="block text-sm font-medium" htmlFor="registration-confirm">Confirmar contraseña
      <input id="registration-confirm" name="confirmPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" disabled={pending}
        className="mt-2 min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:ring-2 focus:ring-accent/20" />
    </label>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.message && <p role="status" className="text-sm leading-6 text-muted">{state.message}</p>}
    <button disabled={pending} className="min-h-11 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60">
      {pending ? 'Creando cuenta…' : 'Crear cuenta'}
    </button>
    <p className="text-center text-sm text-muted">¿Ya tienes contraseña? <Link className="text-accent hover:underline" href="/login">Iniciar sesión</Link></p>
    <p className="text-center text-sm"><Link className="text-accent hover:underline" href="/login/forgot-password">Olvidé mi contraseña</Link></p>
  </form>;
}
