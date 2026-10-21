'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { acceptInvitation } from './actions';

export function InvitationForm() {
  const [state, action, pending] = useActionState(acceptInvitation, { error: null });
  const [token, setToken] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    window.history.replaceState(null, '', '/auth/invitation');
    // Fragment credentials exist only in the browser, after hydration.
    setToken(value);
  }, []);
  if (token === null) return <p role="status" className="text-sm text-muted">Preparando tu invitación…</p>;
  if (!token) return <div><p role="alert" className="text-sm text-muted">Abre el enlace completo que te envió Acelera.</p><Link href="/login" className="mt-4 inline-flex min-h-11 items-center text-accent">Iniciar sesión</Link></div>;
  return <form action={action} className="space-y-5">
    <input type="hidden" name="token" value={token} />
    <p className="text-sm text-muted">Tu invitación es personal y tiene una vigencia de 48 horas desde su generación.</p>
    {state.error && <p role="alert" className="text-sm text-[var(--danger)]">{state.error}</p>}
    <button disabled={pending} className="min-h-11 w-full rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Verificando…' : 'Continuar y crear mi contraseña'}</button>
  </form>;
}
