import Link from "next/link";
import { cadenceSeverityColor } from "@/lib/progress-color";

export interface BehindCadenceClient {
  id: string;
  name: string;
  daysSinceLastCall: number;
}

export function BehindCadenceList({ clients }: { clients: BehindCadenceClient[] }) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-2">
        Todos los clientes activos con programa configurado tuvieron su llamada esta semana.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
      {clients.map((client) => {
        const color = cadenceSeverityColor(client.daysSinceLastCall);
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
              {client.daysSinceLastCall}d
            </span>
            <span className="line-clamp-2 w-full px-0.5 text-[8.5px] font-medium leading-[1.15] text-muted">
              {client.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
