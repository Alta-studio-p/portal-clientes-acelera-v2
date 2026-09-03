"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { formatShortDate, formatDuration } from "@/lib/format";

export interface CallCardData {
  id: string;
  title: string;
  startedAt: string | null;
  durationSeconds: number | null;
  searchText: string;
  topics: string[];
  monthKey: string | null;
  monthLabel: string | null;
}

export function CallCarousel({
  calls,
  selectedCallId,
  hrefBase,
}: {
  calls: CallCardData[];
  selectedCallId: string | null;
  hrefBase: string;
}) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [topic, setTopic] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of calls) {
      if (c.monthKey && c.monthLabel && !seen.has(c.monthKey)) seen.set(c.monthKey, c.monthLabel);
    }
    return Array.from(seen.entries());
  }, [calls]);

  const topics = useMemo(() => {
    const seen = new Set<string>();
    for (const c of calls) for (const t of c.topics) seen.add(t);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [calls]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = calls.filter(
    (c) =>
      (!normalizedQuery || c.searchText.includes(normalizedQuery)) &&
      (!month || c.monthKey === month) &&
      (!topic || c.topics.includes(topic))
  );

  const hasFilters = Boolean(normalizedQuery || month || topic);

  function scrollByCards(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 288, behavior: "smooth" });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M17 17l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por tema o contenido"
            aria-label="Buscar llamadas"
            className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        {months.length > 1 && (
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Filtrar por fecha"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">Todas las fechas</option>
            {months.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        )}

        {topics.length > 0 && (
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label="Filtrar por tema"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">Todos los temas</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted">
          {hasFilters ? "Sin resultados para tu búsqueda." : "Sin llamadas registradas."}
        </p>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            aria-label="Llamadas anteriores"
            className="absolute -left-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface shadow-sm transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:flex"
          >
            <span aria-hidden="true">‹</span>
          </button>

          <div
            ref={scrollRef}
            className="flex snap-x snap-proximity gap-3 overflow-x-auto scroll-smooth px-1 py-1 sm:px-8"
          >
            {filtered.map((call) => {
              const active = call.id === selectedCallId;
              return (
                <Link
                  key={call.id}
                  href={`${hrefBase}?call=${call.id}`}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`w-56 shrink-0 snap-start rounded-xl border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                    active
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-surface hover:bg-surface-muted"
                  }`}
                >
                  <p className={`text-xs font-medium ${active ? "text-white/80" : "text-muted-2"}`}>
                    {formatShortDate(call.startedAt)}
                  </p>
                  <p
                    className={`mt-1.5 line-clamp-2 text-sm font-semibold ${
                      active ? "text-white" : "text-foreground"
                    }`}
                  >
                    {call.title}
                  </p>
                  <p className={`mt-1.5 text-xs ${active ? "text-white/80" : "text-muted-2"}`}>
                    {formatDuration(call.durationSeconds)}
                  </p>
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollByCards(1)}
            aria-label="Llamadas siguientes"
            className="absolute -right-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface shadow-sm transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:flex"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </div>
  );
}
