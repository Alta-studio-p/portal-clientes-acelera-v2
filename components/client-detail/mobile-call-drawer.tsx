"use client";

import { useEffect, useState } from "react";
import { ListFilter, X } from "lucide-react";
import { CallListPanel, type CallCardData } from "@/components/client-detail/call-list-panel";

export function MobileCallDrawer({
  calls,
  selectedCallId,
  hrefBase,
}: {
  calls: CallCardData[];
  selectedCallId: string | null;
  hrefBase: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="mb-4 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm font-semibold text-foreground transition hover:bg-surface-muted"
      >
        <ListFilter size={18} strokeWidth={2} aria-hidden="true" />
        Seleccionar llamada
      </button>

      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Todas las llamadas">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/30 transition"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-[26px] border border-border bg-surface shadow-[0_-20px_60px_-20px_rgba(15,23,42,0.35)]">
            <div className="flex shrink-0 items-center justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar lista de llamadas"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <CallListPanel
                calls={calls}
                selectedCallId={selectedCallId}
                hrefBase={hrefBase}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
