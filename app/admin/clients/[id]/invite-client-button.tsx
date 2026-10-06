'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { MailPlus, X } from 'lucide-react';
import { inviteClient } from './invite-actions';

export function InviteClientButton({ clientId, email, name, linked }: { clientId: string; email: string; name: string; linked: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent"><MailPlus size={16} aria-hidden="true" />{linked ? 'Reenviar acceso' : 'Invitar cliente'}</button>
    {open && <InviteDialog clientId={clientId} email={email} name={name} onClose={() => setOpen(false)} />}
  </>;
}

function InviteDialog({ clientId, email, name, onClose }: { clientId: string; email: string; name: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(inviteClient, { error: null, message: null });
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-label="Invitar cliente" onCancel={e => { if (pending) e.preventDefault(); else onClose(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-lg border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/40">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Acceso al portal</h2><button onClick={onClose} disabled={pending} aria-label="Cerrar" title="Cerrar" className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-muted"><X size={18} /></button></div>
    <p className="mb-4 text-sm">{name}</p>
    <form action={action}>
      <input type="hidden" name="clientId" value={clientId} />
      <label className="block text-sm">Correo del cliente<input name="email" type="email" value={email || ''} readOnly required className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm" /></label>
      <p className="mt-3 text-sm text-muted">Recibirá un enlace para crear su contraseña. Su acceso será únicamente a su ficha.</p>
      {state.error && <p role="alert" className="mt-4 rounded-md bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger)]">{state.error}</p>}
      {state.message && <p role="status" className="mt-4 rounded-md bg-accent-soft p-3 text-sm text-accent">{state.message}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-md border border-border px-4 text-sm">{state.message ? 'Cerrar' : 'Cancelar'}</button>{!state.message && <button disabled={pending || !email} className="min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Enviando…' : 'Enviar invitación'}</button>}</div>
    </form>
  </dialog>;
}
