import type { CoachCallCount } from "@/lib/data/admin";

// Paleta categórica fija (ver app/globals.css) — mismo orden siempre,
// asignado por posición en la lista de coaches (orden alfabético, estable).
const SLOT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function CoachCallsChart({ data }: { data: CoachCallCount[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  if (data.length === 0) {
    return <p className="text-sm text-muted-2">Sin coaches activos.</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((coach, i) => {
        const widthPct = coach.count === 0 ? 0 : Math.max(3, (coach.count / max) * 100);
        const color = SLOT_COLORS[i % SLOT_COLORS.length];
        return (
          <div key={coach.coachId}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                {coach.name}
              </span>
              <span className="tabular-nums font-semibold text-foreground">{coach.count}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[--border]">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
