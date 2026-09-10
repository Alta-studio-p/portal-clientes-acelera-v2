"use client";

import { useState } from "react";
import { CalendarX } from "lucide-react";
import type { DailyCallCount } from "@/lib/data/admin";
import { formatShortDate } from "@/lib/format";

export function DailyCallsChart({ data }: { data: DailyCallCount[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...data.map((d) => d.count));
  const dense = data.length > 45;

  if (total === 0) {
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
            {data.map((d, i) => {
              const heightPx = d.count === 0 ? 2 : Math.max(6, Math.round((d.count / max) * CHART_HEIGHT_PX));
              const isHovered = hovered === i;
              const isToday = i === data.length - 1;
              return (
                <div
                  key={d.date}
                  className="group relative flex h-full min-w-[3px] flex-1 items-end"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatShortDate(d.date)}: ${d.count} llamada${d.count === 1 ? "" : "s"}`}
                >
                  <div
                    className={`w-full rounded-t-[4px] transition-colors ${
                      isHovered ? "bg-accent-hover" : isToday ? "bg-accent" : "bg-accent/80"
                    }`}
                    style={{ height: heightPx }}
                  />
                  {isHovered && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-white shadow-lg">
                      <span className="font-semibold tabular-nums">{d.count}</span>{" "}
                      {d.count === 1 ? "llamada" : "llamadas"} · {formatShortDate(d.date)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-1.5 flex gap-[3px]">
            {data.map((d, i) => {
              const isToday = i === data.length - 1;
              const showLabel = isToday || i % labelStep === 0;
              return (
                <div
                  key={d.date}
                  className={`min-w-[3px] flex-1 whitespace-nowrap text-center text-[10px] ${
                    isToday ? "font-semibold text-accent" : "text-muted-2"
                  }`}
                >
                  {showLabel ? (isToday ? "Hoy" : formatShortDate(d.date)) : ""}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-3 text-xs font-medium text-accent hover:underline"
      >
        {showTable ? "Ocultar tabla" : "Ver como tabla"}
      </button>

      {showTable && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-muted">
              <tr className="text-left text-muted-2">
                <th className="px-3 py-1.5 font-medium">Fecha</th>
                <th className="px-3 py-1.5 font-medium">Llamadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5 text-foreground">{formatShortDate(d.date)}</td>
                  <td className="px-3 py-1.5 tabular-nums text-foreground">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
