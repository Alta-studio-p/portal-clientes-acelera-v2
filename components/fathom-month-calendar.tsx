"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { displayCallTitle } from "@/lib/call-title";
import type { AdminFathomCalendarCall } from "@/lib/data/admin";

const TIME_ZONE = "America/Bogota";
const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

export interface FathomMonthCell {
  key: string;
  day: number | null;
  dateKey: string | null;
}

function callDayKey(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function timeOnly(value: string | null) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function dateTimeLabel(value: string | null) {
  if (!value) return "Hora sin registrar";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function callStatus(call: AdminFathomCalendarCall) {
  if (!call.client_id) {
    return {
      label: "Sin cliente",
      className: "bg-[--danger-bg] text-[--danger]",
    };
  }

  if (!call.summary) {
    return {
      label: "Sin resumen",
      className: "bg-[--status-extension-bg] text-[--status-extension]",
    };
  }

  return {
    label: "Tomada",
    className: "bg-[--status-active-bg] text-[--status-active]",
  };
}

function CalendarCall({
  call,
  isOpen,
  onToggle,
}: {
  call: AdminFathomCalendarCall;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const status = callStatus(call);
  const clientName = call.client?.full_name || call.client?.email || "Cliente sin asignar";
  const title = displayCallTitle(call);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={`flex w-full cursor-pointer items-start gap-2 rounded-md border bg-surface px-2.5 py-2 text-left shadow-sm transition hover:border-accent/40 hover:bg-accent-soft/40 focus:outline-none focus:ring-2 focus:ring-accent/20 ${
          isOpen ? "border-accent/50 ring-2 ring-accent/20" : "border-border"
        }`}
      >
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold tabular-nums text-accent">
            {timeOnly(call.started_at)}
          </span>
          <span className="mt-0.5 block truncate text-xs font-semibold leading-snug text-foreground">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted">{clientName}</span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-4 shadow-2xl ring-1 ring-black/5 xl:left-1/2 xl:-translate-x-1/2">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-muted-2">Llamada</p>
              <h3 className="mt-1 text-base font-semibold leading-snug text-foreground">
                {title}
              </h3>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          <div className="space-y-2 border-y border-border py-3 text-sm">
            <div>
              <p className="text-[11px] font-medium uppercase text-muted-2">Cliente</p>
              <p className="mt-0.5 text-foreground">{clientName}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase text-muted-2">Hora</p>
              <p className="mt-0.5 text-foreground">{dateTimeLabel(call.started_at)}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {call.client_id && (
              <Link
                href={`/admin/clients/${call.client_id}?call=${call.id}`}
                className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-hover"
              >
                Ver resumen
              </Link>
            )}
            {call.recording_url && (
              <a
                href={call.recording_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
              >
                Ver grabación
              </a>
            )}
          </div>

          {!call.client_id && (
            <p className="mt-3 rounded-md bg-[--danger-bg] px-3 py-2 text-xs text-[--danger]">
              Esta grabación todavía no está vinculada a un cliente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function FathomMonthCalendar({
  cells,
  calls,
}: {
  cells: FathomMonthCell[];
  calls: AdminFathomCalendarCall[];
}) {
  const [openCallId, setOpenCallId] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!calendarRef.current?.contains(event.target as Node)) {
        setOpenCallId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenCallId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={calendarRef}>
      <div className="mb-3 hidden grid-cols-7 gap-2 xl:grid">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="px-2 text-xs font-semibold uppercase text-muted-2">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7 xl:gap-2">
        {cells.map((cell) => {
          const dayCalls = cell.dateKey
            ? calls.filter((call) => callDayKey(call.started_at) === cell.dateKey)
            : [];

          return (
            <div
              key={cell.key}
              className={`min-h-36 rounded-lg border p-3 ${
                cell.day
                  ? dayCalls.length > 0
                    ? "border-border bg-background"
                    : "border-border/70 bg-surface-muted/40"
                  : "hidden border-transparent bg-transparent xl:block"
              }`}
            >
              {cell.day && (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-2 xl:hidden">
                        {new Date(`${cell.dateKey}T12:00:00`).toLocaleDateString("es-MX", {
                          weekday: "short",
                        })}
                      </p>
                      <p className="text-base font-semibold text-foreground">{cell.day}</p>
                    </div>
                    {dayCalls.length > 0 && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                        {dayCalls.length}
                      </span>
                    )}
                  </div>
                  {dayCalls.length === 0 ? (
                    <p className="mt-6 rounded-md border border-dashed border-border/70 px-2 py-3 text-center text-xs text-muted-2">
                      Sin grabaciones
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {dayCalls.map((call) => (
                        <CalendarCall
                          key={call.id}
                          call={call}
                          isOpen={openCallId === call.id}
                          onToggle={() => setOpenCallId(openCallId === call.id ? null : call.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
