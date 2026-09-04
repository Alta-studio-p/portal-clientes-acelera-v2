"use client";

import { useActionState, useState } from "react";
import { addThreeMonthsSameDay } from "@/lib/program-dates";
import { updateClientDates, type UpdateDatesState } from "@/lib/actions/client-dates";

const initialState: UpdateDatesState = { error: null, success: false };

export function ClientDatesForm({
  clientId,
  startDate,
  endDate,
}: {
  clientId: string;
  startDate: string | null;
  endDate: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateClientDates, initialState);
  const [start, setStart] = useState(startDate ?? "");
  const [end, setEnd] = useState(endDate ?? "");

  function handleStartChange(value: string) {
    setStart(value);
    // Solo autocompleta la fecha final la primera vez (cuando aún está
    // vacía) para no pisar una extensión ya editada a mano.
    if (value && !end) {
      setEnd(addThreeMonthsSameDay(value));
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <p className="text-xs font-medium text-muted-2">Fechas del programa</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="start_date" className="text-[11px] text-muted-2">
            Inicio
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            value={start}
            onChange={(e) => handleStartChange(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label htmlFor="end_date" className="text-[11px] text-muted-2">
            Final
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar fechas"}
      </button>
      {state.error && <p className="mt-1.5 text-xs text-[--danger]">{state.error}</p>}
      {state.success && <p className="mt-1.5 text-xs text-[--status-active]">Fechas guardadas.</p>}
    </form>
  );
}
