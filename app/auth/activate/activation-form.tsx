'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { setNewPassword } from './actions';

export function ActivationForm() {
  const [state, action, pending] = useActionState(setNewPassword, { error: null });
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function activate() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const query = new URLSearchParams(window.location.search);
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        const token_hash = hash.get('token_hash');
        const type = hash.get('type');
        const code = query.get('code');
        // Remove credentials from the address bar before rendering the form.
        window.history.replaceState(null, '', '/auth/activate');
        if (hash.get('error') || query.get('error')) throw new Error('invalid_link');
        if (token_hash) {
          if (type !== 'invite' && type !== 'recovery') throw new Error('invalid_link');
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) throw error;
        } else if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error('invalid_link');
        setEmail(data.user.email ?? '');
        setReady(true);
      } catch {
        setError('El enlace venció o no es válido. Solicita uno nuevo desde “Olvidé mi contraseña”.');
      }
    }
    void activate();
  }, []);
  if (error) return <div><p role="alert" className="text-sm text-[var(--danger)]">{error}</p><Link href="/login/forgot-password" className="mt-4 inline-flex min-h-11 items-center text-sm text-accent hover:underline">Solicitar otro enlace</Link></div>;
  if (!ready) return <p role="status" className="text-sm text-muted">Verificando tu acceso…</p>;
  const input = 'mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';
  return <form action={action} className="space-y-4">
    <p className="break-words text-sm text-muted">{email}</p>
    <label className="block text-sm">Contraseña<input className={input} name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={pending} /></label>
    <label className="block text-sm">Confirmar contraseña<input className={input} name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={pending} /></label>
    <p className="text-xs text-muted">Mínimo 10 caracteres.</p>
    {state.error && <p role="alert" className="text-sm text-[var(--danger)]">{state.error}</p>}
    <button disabled={pending} className="min-h-11 w-full rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Guardando…' : 'Guardar contraseña y entrar'}</button>
  </form>;
}
