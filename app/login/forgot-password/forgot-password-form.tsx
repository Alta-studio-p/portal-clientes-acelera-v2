'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { forgotPasswordAction, type ForgotPasswordState } from './actions';

const initialState: ForgotPasswordState = { error: null, message: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  if (state.message) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm text-foreground">{state.message}</p>
        <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-accent hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted">
          Usuario o correo
        </label>
        <input
          id="email"
          name="email"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          placeholder="tu usuario o correo"
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-[--danger-bg] px-3 py-2 text-xs text-[--danger]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Enviar enlace'}
      </button>

      <Link href="/login" className="block text-center text-xs text-muted hover:underline">
        Volver al inicio de sesión
      </Link>
    </form>
  );
}
