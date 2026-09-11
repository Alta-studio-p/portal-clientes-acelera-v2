"use client";

import { useState } from "react";
import { CalendarX } from "lucide-react";
import type { DailyCallBar } from "@/lib/data/admin";
import { formatShortDate } from "@/lib/format";

const COLOR_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function DailyCallsChart({
  data,
  coaches,
}: {
  data: DailyCallBar[];
  coaches: { coachId: string; name: string }[];
}) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const grandTotal = data.reduce((sum, d) => sum + d.total, 0);
  const maxTotal = Math.max(1, ...data.map((d) => d.total));
  const dense = data.length > 45;

  const colorFor = (coachId: string) => {
    const idx = coaches.findIndex((c) => c.coachId === coachId);
    return COLOR_VARS[idx >= 0 ? idx % COLOR_VARS.length : COLOR_VARS.length - 1];
  };

  if (grandTotal === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-surface-muted px-4 py-3.5 text-sm text-muted-2">
        <CalendarX size={17} strokeWidth={2} className="shrink-0" aria-hidden="true" />
        Sin llamadas registradas entre {formatShortDate(data[0]?.date ?? null)} y hoy.
      </div>
    );
  }

  const CHART_HEIGHT_PX = 144;
  // Etiquetar ~8 fechas repartidas a lo largo del eje, más la última (hoy) —
  // nunca una etiqueta por barra, se vuelve ilegible en el rango de 90 días.
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div>
      <div className="overflow-x-auto">
        <div style={dense ? { minWidth: data.length * 7 } : undefined}>
          <div className="flex items-end gap-[3px]" style={{ height: CHART_HEIGHT_PX }}>
            {data.map((day, dayIndex) => {
              const totalHeightPx =
                day.total === 0 ? 2 : Math.max(6, Math.round((day.total / maxTotal) * CHART_HEIGHT_PX));
              const isDayHovered = hoveredDay === dayIndex;

              return (
                <div
                  key={day.date}
                  className="group relative flex h-full min-w-[10px] flex-1 cursor-pointer items-end"
                  onMouseEnter={() => setHoveredDay(dayIndex)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onFocus={() => setHoveredDay(dayIndex)}
                  onBlur={() => setHoveredDay(null)}
                  tabIndex={0}
                  aria-label={`${formatShortDate(day.date)}: ${day.total} llamada${day.total === 1 ? "" : "s"}${
                    day.segments.length > 0
                      ? ", " + day.segments.map((s) => `${s.name} ${s.count}`).join(", ")
                      : ""
                  }`}
                >
                  {isDayHovered && day.segments.length > 0 && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-2 text-xs text-white shadow-lg">
                      <p className="mb-1 font-semibold">{formatShortDate(day.date)} · {day.total} llamadas</p>
                      <ul className="space-y-0.5">
                        {day.segments.map((seg) => (
                          <li key={seg.coachId} className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: colorFor(seg.coachId) }}
                              aria-hidden="true"
                            />
                            <span className="flex-1">{seg.name}</span>
                            <span className="font-semibold tabular-nums">{seg.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div
                    className={`flex w-full flex-col transition-opacity ${isDayHovered ? "" : "group-hover:opacity-80"}`}
                    style={{ height: totalHeightPx }}
                  >
                    {day.segments.length === 0 ? (
                      <div className="w-full flex-1 rounded-t-[4px] bg-border/60" />
                    ) : (
                      day.segments.map((seg, segIndex) => {
                        const segHeightPx = Math.max(2, Math.round((seg.count / day.total) * totalHeightPx));
                        return (
                          <div
                            key={seg.coachId}
                            className={`w-full ${segIndex === 0 ? "rounded-t-[4px]" : ""}`}
                            style={{
                              height: segHeightPx,
                              backgroundColor: colorFor(seg.coachId),
                              marginBottom: segIndex < day.segments.length - 1 ? 1 : 0,
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-1.5 flex gap-[3px]">
            {data.map((day, i) => {
              const isToday = i === data.length - 1;
              const showLabel = isToday || i % labelStep === 0;
              return (
                <div
                  key={day.date}
                  className={`min-w-[3px] flex-1 whitespace-nowrap text-center text-[10px] ${
                    isToday ? "font-semibold text-accent" : "text-muted-2"
                  }`}
                >
                  {showLabel ? (isToday ? "Hoy" : formatShortDate(day.date)) : ""}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {coaches.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {coaches.map((coach, i) => (
            <span key={coach.coachId} className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLOR_VARS[i % COLOR_VARS.length] }}
                aria-hidden="true"
              />
              {coach.name}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-3 text-xs font-medium text-accent hover:underline"
      >
        {showTable ? "Ocultar tabla" : "Ver como tabla"}
      </button>

      {showTable && (
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-max text-xs">
            <thead className="sticky top-0 bg-surface-muted">
              <tr className="text-left text-muted-2">
                <th className="px-3 py-1.5 font-medium">Fecha</th>
                {coaches.map((coach) => (
                  <th key={coach.coachId} className="px-3 py-1.5 font-medium">
                    {coach.name}
                  </th>
                ))}
                <th className="px-3 py-1.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((day) => (
                <tr key={day.date}>
                  <td className="px-3 py-1.5 text-foreground">{formatShortDate(day.date)}</td>
                  {coaches.map((coach) => (
                    <td key={coach.coachId} className="px-3 py-1.5 tabular-nums text-foreground">
                      {day.segments.find((s) => s.coachId === coach.coachId)?.count ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 tabular-nums font-medium text-foreground">{day.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
