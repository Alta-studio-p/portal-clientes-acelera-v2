"use client";

import { useActionState, useState } from "react";
import { createClientAction, type CreateClientState } from "./actions";

const initialState: CreateClientState = { error: null, success: false };

export function AddClientForm({
  coaches,
}: {
  coaches: { id: string; full_name: string | null; email: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createClientAction, initialState);

  const [handledSuccess, setHandledSuccess] = useState(false);
  if (state.success && !handledSuccess) {
    setHandledSuccess(true);
    setOpen(false);
  } else if (!state.success && handledSuccess) {
    setHandledSuccess(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        + Agregar cliente
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-surface p-4 sm:w-[420px]">
      <form key={String(state.success)} action={formAction} className="space-y-3">
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-xs font-medium text-muted">
            Nombre completo
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="Nombre del cliente"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="cliente@correo.com"
          />
          <p className="mt-1 text-xs text-muted-2">
            Debe coincidir con el correo que usa en Fathom para que sus llamadas se vinculen
            automáticamente.
          </p>
        </div>

        <div>
          <label htmlFor="coachId" className="mb-1.5 block text-xs font-medium text-muted">
            Coach (opcional)
          </label>
          <select
            id="coachId"
            name="coachId"
            defaultValue=""
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">Sin asignar</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || c.email}
              </option>
            ))}
          </select>
        </div>

        {state.error && (
          <p className="rounded-md bg-[--danger-bg] px-3 py-2 text-xs text-[--danger]">
            {state.error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar cliente"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
