"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { formatShortDate, formatDuration } from "@/lib/format";

export interface CallCardData {
  id: string;
  title: string;
  startedAt: string | null;
  durationSeconds: number | null;
  preview: string | null;
  searchText: string;
}

export function CallListPanel({
  calls,
  selectedCallId,
  hrefBase,
  onNavigate,
}: {
  calls: CallCardData[];
  selectedCallId: string | null;
  hrefBase: string;
  /** Se llama al elegir una llamada (usado para cerrar el drawer en móvil). */
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [oldestFirst, setOldestFirst] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = normalizedQuery ? calls.filter((c) => c.searchText.includes(normalizedQuery)) : calls;
    if (!oldestFirst) return base;
    return [...base].reverse();
  }, [calls, normalizedQuery, oldestFirst]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-5 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-foreground">Todas las llamadas</h2>
          <span className="text-sm text-muted-2">{calls.length}</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={18}
              strokeWidth={2}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar llamada"
              aria-label="Buscar llamada"
              className="h-11 w-full rounded-full border border-transparent bg-surface pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-2 focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setOldestFirst((v) => !v)}
            aria-pressed={oldestFirst}
            aria-label={oldestFirst ? "Ordenando de más antigua a más reciente" : "Ordenando de más reciente a más antigua"}
            title={oldestFirst ? "Más antigua primero" : "Más reciente primero"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-transparent bg-surface text-muted transition hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <ArrowUpDown size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-5">
        {filtered.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            {normalizedQuery ? "Sin resultados para tu búsqueda." : "Sin llamadas registradas."}
          </p>
        ) : (
          filtered.map((call) => {
            const active = call.id === selectedCallId;
            return (
              <Link
                key={call.id}
                href={`${hrefBase}?call=${call.id}`}
                scroll={false}
                onClick={onNavigate}
                aria-current={active ? "true" : undefined}
                className={`block rounded-[18px] border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-transparent bg-surface hover:bg-surface-muted active:bg-surface-muted"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-muted-2">{formatShortDate(call.startedAt)}</span>
                  <span className="shrink-0 text-xs text-muted-2">{formatDuration(call.durationSeconds)}</span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-[15px] font-semibold text-foreground">{call.title}</p>
                {call.preview && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">{call.preview}</p>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
