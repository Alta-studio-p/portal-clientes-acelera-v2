"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import type { MonthCalendarCall } from "@/lib/data/admin";
import { displayCallTitle } from "@/lib/call-title";

const TIME_ZONE = "America/Bogota";
const HOUR_HEIGHT = 72; // px
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const COLOR_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];
const NO_COACH_COLOR = "#9498a3";
const DEFAULT_RANGE: [number, number] = [7, 20]; // 7am–8pm si no hay llamadas fuera de ese rango

export interface WeekDay {
  dateKey: string; // YYYY-MM-DD
  dayNum: number;
  isToday: boolean;
}

function hourFraction(iso: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

function dayKey(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE }).format(
    new Date(iso)
  );
}

function timeOnly(iso: string | null): string {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE })
    .format(new Date(iso))
    .toLowerCase();
}

function dateTimeLabel(iso: string | null): string {
  if (!iso) return "Hora sin registrar";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

function formatHourLabel(hour: number): string {
  const h = Math.floor(hour);
  const period = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

interface PositionedEvent extends MonthCalendarCall {
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

// Asigna "carriles" a llamadas que se solapan en el mismo día, estilo Google
// Calendar (se ponen una al lado de la otra en vez de encimarse).
function layoutDayEvents(events: MonthCalendarCall[]): PositionedEvent[] {
  const withTimes = events
    .map((e) => {
      const start = hourFraction(e.started_at);
      const end = start + Math.max((e.duration_seconds ?? 1800) / 3600, 1 / 3);
      return { ...e, start, end };
    })
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];
  const placed = withTimes.map((ev) => {
    let lane = laneEnds.findIndex((end) => end <= ev.start + 0.01);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(ev.end);
    } else {
      laneEnds[lane] = ev.end;
    }
    return { ...ev, lane };
  });

  const lanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, lanes }));
}

export function GoogleWeekCalendar({
  days,
  calls,
  coaches,
}: {
  days: WeekDay[];
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
  const rootRef = useRef<HTMLDivElement>(null);

  const colorFor = (coachId: string | null) => legend.find((l) => l.id === (coachId ?? "none"))?.color ?? NO_COACH_COLOR;
  const visibleCalls = calls.filter((c) => !hidden.has(c.coachId ?? "none"));

  const [rangeStart, rangeEnd] = useMemo(() => {
    if (visibleCalls.length === 0) return DEFAULT_RANGE;
    let min = DEFAULT_RANGE[0];
    let max = DEFAULT_RANGE[1];
    for (const call of visibleCalls) {
      const start = hourFraction(call.started_at);
      const end = start + Math.max((call.duration_seconds ?? 1800) / 3600, 1 / 3);
      min = Math.min(min, Math.floor(start));
      max = Math.max(max, Math.ceil(end));
    }
    return [Math.max(0, min - 1), Math.min(24, max + 1)];
  }, [visibleCalls]);

  const totalHours = rangeEnd - rangeStart;
  const hours = Array.from({ length: totalHours }, (_, i) => rangeStart + i);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>();
    for (const day of days) {
      const dayCalls = visibleCalls.filter((c) => dayKey(c.started_at) === day.dateKey);
      map.set(day.dateKey, layoutDayEvents(dayCalls));
    }
    return map;
  }, [days, visibleCalls]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenCallId(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenCallId(null);
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

  return (
    <div ref={rootRef} className="flex flex-col gap-4 lg:flex-row lg:items-start">
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

      <div className="min-w-0 flex-1">
        <div className="min-w-[760px]">
          {/* Encabezado: días de la semana */}
          <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
            <div />
            {days.map((day, i) => (
              <div key={day.dateKey} className="flex flex-col items-center border-b border-border pb-2">
                <span className="text-sm font-medium uppercase text-muted-2">{DAY_LABELS[i]}</span>
                <span
                  className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold ${
                    day.isToday ? "bg-accent text-white" : "text-foreground"
                  }`}
                >
                  {day.dayNum}
                </span>
              </div>
            ))}
          </div>

          {/* Grid de horas */}
          <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
            <div className="relative" style={{ height: totalHours * HOUR_HEIGHT }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-right text-xs font-medium text-muted-2"
                  style={{ top: (h - rangeStart) * HOUR_HEIGHT }}
                >
                  {formatHourLabel(h)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayEvents = eventsByDay.get(day.dateKey) ?? [];
              return (
                <div
                  key={day.dateKey}
                  className="relative border-l border-border"
                  style={{ height: totalHours * HOUR_HEIGHT }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-border/60"
                      style={{ top: (h - rangeStart) * HOUR_HEIGHT }}
                    />
                  ))}

                  {dayEvents.map((ev) => {
                    const color = colorFor(ev.coachId);
                    const top = Math.max(0, (ev.start - rangeStart) * HOUR_HEIGHT);
                    const height = Math.max(26, (ev.end - ev.start) * HOUR_HEIGHT - 2);
                    const widthPct = 100 / ev.lanes;
                    return (
                      <div
                        key={ev.id}
                        className="absolute px-[1px]"
                        style={{ top, height, left: `${ev.lane * widthPct}%`, width: `${widthPct}%` }}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenCallId(openCallId === ev.id ? null : ev.id)}
                          className="h-full w-full overflow-hidden rounded-[4px] border-l-[3px] px-1.5 py-0.5 text-left text-xs leading-tight transition hover:brightness-95"
                          style={{ backgroundColor: `${color}1f`, borderLeftColor: color, color: "var(--foreground)" }}
                        >
                          <span className="font-semibold tabular-nums" style={{ color }}>
                            {timeOnly(ev.started_at)}
                          </span>{" "}
                          {displayCallTitle(ev)}
                        </button>

                        {openCallId === ev.id && (
                          <CallPopover call={ev} color={color} onClose={() => setOpenCallId(null)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
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
          <h3 className="text-base font-semibold leading-snug text-foreground">{displayCallTitle(call)}</h3>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-sm text-muted-2 hover:text-foreground">
          ✕
        </button>
      </div>

      <div className="space-y-1.5 border-y border-border py-2.5 text-sm">
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
            className="rounded-md bg-accent px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Ver resumen
          </Link>
        )}
        {call.recording_url && (
          <a
            href={call.recording_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-sm font-semibold text-foreground hover:bg-surface-muted"
          >
            <Play size={12} strokeWidth={2} aria-hidden="true" /> Grabación
            <ExternalLink size={11} strokeWidth={2} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
