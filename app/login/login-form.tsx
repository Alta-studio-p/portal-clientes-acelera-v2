"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />

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
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          placeholder="tu usuario o correo"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="block text-xs font-medium text-muted">
            Contraseña
          </label>
          <Link href="/login/forgot-password" className="text-xs text-accent hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          placeholder="••••••••"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-[--danger-bg] px-3 py-2 text-xs text-[--danger]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
