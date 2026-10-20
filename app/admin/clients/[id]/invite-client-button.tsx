'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, MailPlus, X } from 'lucide-react';
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
  const [state, action, pending] = useActionState(inviteClient, { error: null, message: null, link: null });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copyLink() {
    if (!state.link) return;
    try { await navigator.clipboard.writeText(state.link); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-label="Invitar cliente" onCancel={e => { if (pending) e.preventDefault(); else onClose(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-lg border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/40">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Acceso al portal</h2><button onClick={onClose} disabled={pending} aria-label="Cerrar" title="Cerrar" className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-muted"><X size={18} /></button></div>
    <p className="mb-4 text-sm">{name}</p>
    <form action={action}>
      <input type="hidden" name="clientId" value={clientId} />
      <label className="block text-sm">Correo del cliente<input name="email" type="email" value={email || ''} readOnly required className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm" /></label>
      <p className="mt-3 text-sm text-muted">Su acceso será únicamente a su ficha.</p>
      {state.error && <p role="alert" className="mt-4 rounded-md bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger)]">{state.error}</p>}
      {state.message && <p role="status" className="mt-4 rounded-md bg-accent-soft p-3 text-sm text-accent">{state.message}</p>}
      {state.link && <div className="mt-4 space-y-3">
        <label className="block text-sm">Enlace privado de activación<textarea value={state.link} readOnly rows={3} onFocus={e => e.target.select()} className="mt-2 w-full resize-none break-all rounded-md border border-border bg-background p-3 text-xs" /></label>
        <button type="button" onClick={copyLink} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-accent">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
        {copied && <p role="status" className="text-sm text-accent">Ya puedes pegarlo en el WhatsApp del cliente.</p>}
        {copyError && <p role="alert" className="text-sm text-[var(--danger)]">No se pudo copiar automáticamente. Selecciona el enlace y cópialo manualmente.</p>}
      </div>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} onClick={onClose} className="min-h-11 rounded-md border border-border px-4 text-sm">{state.message ? 'Cerrar' : 'Cancelar'}</button>
        {!state.message && <>
          <button name="delivery" value="email" disabled={pending || !email} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm disabled:opacity-50"><MailPlus size={16} />Enviar por correo</button>
          <button name="delivery" value="link" disabled={pending || !email} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-white disabled:opacity-50"><Link2 size={16} />{pending ? 'Procesando…' : 'Generar enlace'}</button>
        </>}
      </div>
    </form>
  </dialog>;
}
