"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import type { MonthCalendarCall } from "@/lib/data/admin";
import { displayCallTitle } from "@/lib/call-title";

const TIME_ZONE = "America/Bogota";
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const COLOR_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];
const NO_COACH_COLOR = "#9498a3"; // --muted-2

export interface CalendarCell {
  key: string;
  day: number | null;
  dateKey: string | null;
  isToday: boolean;
}

function dayKey(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE }).format(
    new Date(value)
  );
}

function timeOnly(value: string | null) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE })
    .format(new Date(value))
    .toLowerCase();
}

function dateTimeLabel(value: string | null) {
  if (!value) return "Hora sin registrar";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function GoogleStyleCalendar({
  cells,
  calls,
  coaches,
}: {
  cells: CalendarCell[];
  calls: MonthCalendarCall[];
  coaches: { coachId: string; name: string }[];
}) {
  const hasUnassigned = calls.some((c) => !c.coachId);
  const legend = useMemo(
    () => [
      ...coaches.map((c, i) => ({ id: c.coachId, name: c.name, color: COLOR_VARS[i % COLOR_VARS.length] })),
      ...(hasUnassigned ? [{ id: "none", name: "Sin coach", color: NO_COACH_COLOR }] : []),
    ],
    [coaches, hasUnassigned]
  );

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [openCallId, setOpenCallId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const colorFor = (coachId: string | null) => legend.find((l) => l.id === (coachId ?? "none"))?.color ?? NO_COACH_COLOR;

  const visibleCalls = calls.filter((c) => !hidden.has(c.coachId ?? "none"));
  const callsByDay = useMemo(() => {
    const map = new Map<string, MonthCalendarCall[]>();
    for (const call of visibleCalls) {
      const key = dayKey(call.started_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(call);
    }
    return map;
  }, [visibleCalls]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenCallId(null);
        setExpandedDay(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenCallId(null);
        setExpandedDay(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function toggleCoach(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const MAX_VISIBLE_PER_DAY = 3;

  return (
    <div ref={rootRef} className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Sidebar: filtro de coaches, estilo "mis calendarios" de Google */}
      <div className="shrink-0 lg:w-48">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">Coaches</p>
        <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {legend.map((item) => {
            const isHidden = hidden.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleCoach(item.id)}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted lg:w-full ${
                  isHidden ? "opacity-40" : ""
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-[4px]"
                  style={{ backgroundColor: isHidden ? "transparent" : item.color, border: `2px solid ${item.color}` }}
                  aria-hidden="true"
                />
                <span className="truncate text-foreground">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid principal */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 hidden grid-cols-7 gap-px xl:grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 pb-2 text-center text-xs font-semibold uppercase text-muted-2">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 xl:grid-cols-7">
          {cells.map((cell) => {
            const dayCalls = cell.dateKey ? (callsByDay.get(cell.dateKey) ?? []) : [];
            const overflow = dayCalls.length - MAX_VISIBLE_PER_DAY;
            const isExpanded = expandedDay === cell.dateKey;

            if (!cell.day) {
              return <div key={cell.key} className="hidden min-h-[7rem] bg-surface-muted/40 xl:block" />;
            }

            return (
              <div key={cell.key} className="relative min-h-[7rem] bg-surface p-1.5">
                <div className="mb-1 flex items-center justify-between xl:justify-end">
                  <span className="text-[11px] font-medium uppercase text-muted-2 xl:hidden">
                    {new Date(`${cell.dateKey}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short" })}
                  </span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      cell.isToday ? "bg-accent text-white" : "text-foreground"
                    }`}
                  >
                    {cell.day}
                  </span>
                </div>

                <div className="space-y-1">
                  {dayCalls.slice(0, MAX_VISIBLE_PER_DAY).map((call) => {
                    const color = colorFor(call.coachId);
                    return (
                      <button
                        key={call.id}
                        type="button"
                        onClick={() => setOpenCallId(openCallId === call.id ? null : call.id)}
                        className="block w-full truncate rounded-[4px] border-l-[3px] bg-surface-muted px-1.5 py-0.5 text-left text-[11px] leading-tight text-foreground transition hover:bg-accent-soft/60"
                        style={{ borderLeftColor: color }}
                      >
                        <span className="font-medium tabular-nums" style={{ color }}>
                          {timeOnly(call.started_at)}
                        </span>{" "}
                        {displayCallTitle(call)}
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(isExpanded ? null : cell.dateKey)}
                      className="block w-full rounded-[4px] px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-2 hover:bg-surface-muted"
                    >
                      +{overflow} más
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="absolute left-1 right-1 top-1 z-20 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-2xl">
                    <p className="mb-1.5 px-1 text-xs font-semibold text-foreground">{cell.day} — {dayCalls.length} llamadas</p>
                    <div className="space-y-1">
                      {dayCalls.map((call) => {
                        const color = colorFor(call.coachId);
                        return (
                          <button
                            key={call.id}
                            type="button"
                            onClick={() => {
                              setOpenCallId(call.id);
                              setExpandedDay(null);
                            }}
                            className="block w-full truncate rounded-[4px] border-l-[3px] bg-surface-muted px-1.5 py-1 text-left text-[11px] leading-tight text-foreground hover:bg-accent-soft/60"
                            style={{ borderLeftColor: color }}
                          >
                            <span className="font-medium tabular-nums" style={{ color }}>
                              {timeOnly(call.started_at)}
                            </span>{" "}
                            {displayCallTitle(call)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {openCallId && dayCalls.some((c) => c.id === openCallId) && (
                  <CallPopover
                    call={dayCalls.find((c) => c.id === openCallId)!}
                    color={colorFor(dayCalls.find((c) => c.id === openCallId)!.coachId)}
                    onClose={() => setOpenCallId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CallPopover({ call, color, onClose }: { call: MonthCalendarCall; color: string; onClose: () => void }) {
  return (
    <div className="absolute left-1/2 top-full z-30 mt-1 w-[min(300px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-surface p-4 shadow-2xl ring-1 ring-black/5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
          <h3 className="text-sm font-semibold leading-snug text-foreground">{displayCallTitle(call)}</h3>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-xs text-muted-2 hover:text-foreground">
          ✕
        </button>
      </div>

      <div className="space-y-1.5 border-y border-border py-2.5 text-xs">
        <p className="text-muted">{dateTimeLabel(call.started_at)}</p>
        <p className="text-muted">
          <span className="font-medium text-foreground">{call.coachName}</span>
          {call.clientName ? <> · {call.clientName}</> : <span className="text-[--danger]"> · sin cliente</span>}
        </p>
        {!call.hasSummary && <p className="text-[--status-extension]">Sin resumen todavía</p>}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {call.clientId && (
          <Link
            href={`/admin/clients/${call.clientId}?call=${call.id}`}
            className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
          >
            Ver resumen
          </Link>
        )}
        {call.recording_url && (
          <a
            href={call.recording_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted"
          >
            <Play size={12} strokeWidth={2} aria-hidden="true" /> Grabación
            <ExternalLink size={11} strokeWidth={2} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
