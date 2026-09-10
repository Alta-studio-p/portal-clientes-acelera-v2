import type { StatusBreakdown } from "@/lib/data/admin";

const SEGMENTS: { key: keyof StatusBreakdown; label: string; color: string; bg: string }[] = [
  { key: "active", label: "Activos", color: "var(--status-active)", bg: "var(--status-active)" },
  { key: "extension", label: "Extensión", color: "var(--status-extension)", bg: "var(--status-extension)" },
  { key: "inactive", label: "Finalizados", color: "var(--status-inactive)", bg: "var(--status-inactive)" },
];

export function StatusBreakdownChart({ data }: { data: StatusBreakdown }) {
  const total = data.active + data.extension + data.inactive;

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-[--border]">
        {SEGMENTS.map((seg) => {
          const value = data[seg.key];
          if (total === 0 || value === 0) return null;
          const widthPct = (value / total) * 100;
          return (
            <div
              key={seg.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${widthPct}%`, backgroundColor: seg.bg, marginRight: "2px" }}
              title={`${seg.label}: ${value}`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden="true" />
            <span className="text-muted">{seg.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{data[seg.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
