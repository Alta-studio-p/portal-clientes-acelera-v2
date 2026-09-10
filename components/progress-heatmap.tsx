import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { progressColor } from "@/lib/progress-color";

export interface ProgressTile {
  id: string;
  name: string;
  percent: number;
}

export function ProgressHeatmap({ clients }: { clients: ProgressTile[] }) {
  if (clients.length === 0) {
    return <p className="text-sm text-muted-2">Sin clientes con progreso pendiente.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
        {clients.map((client) => {
          const color = progressColor(client.percent);
          return (
            <Link
              key={client.id}
              href={`/admin/clients/${client.id}`}
              title={client.name}
              className="group relative flex aspect-square flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border-2 bg-surface px-1 pb-1.5 pt-1 text-center transition-transform hover:-translate-y-0.5"
              style={{
                borderColor: `${color}55`,
                boxShadow: `0 0 0 2px ${color}1a, 0 6px 14px -10px ${color}99`,
              }}
            >
              <span className="text-[13px] font-bold leading-none tabular-nums" style={{ color }}>
                {client.percent}%
              </span>
              <span className="line-clamp-2 w-full px-0.5 text-[8.5px] font-medium leading-[1.15] text-muted">
                {client.name}
              </span>
              <span
                className="absolute inset-x-0 bottom-0 h-[3px]"
                style={{ backgroundColor: `${color}25` }}
                aria-hidden="true"
              >
                <span className="block h-full" style={{ width: `${client.percent}%`, backgroundColor: color }} />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-2">
        <span>Bajo</span>
        <div
          className="h-1.5 flex-1 rounded-full"
          style={{ background: "linear-gradient(to right, #b3261e, #d68552, #1f7a4c)" }}
          aria-hidden="true"
        />
        <span>Alto</span>
      </div>

      <Link
        href="/admin/progress"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-border py-2 text-xs font-semibold text-foreground transition hover:border-accent/60 hover:bg-surface-muted"
      >
        Ver progresos
        <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
      </Link>
    </div>
  );
}
