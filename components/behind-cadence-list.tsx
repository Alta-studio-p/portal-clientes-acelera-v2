import Link from "next/link";
import { cadenceSeverityColor } from "@/lib/progress-color";

export interface BehindCadenceClient {
  id: string;
  name: string;
  coachNames: string[];
  daysSinceLastCall: number;
}

export function BehindCadenceList({ clients }: { clients: BehindCadenceClient[] }) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-2">
        Todos los clientes activos tuvieron su llamada esta semana.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {clients.map((client) => {
        const color = cadenceSeverityColor(client.daysSinceLastCall);
        return (
          <li key={client.id}>
            <Link
              href={`/admin/clients/${client.id}`}
              className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition hover:bg-surface-muted"
            >
              <div
                className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}1f` }}
              >
                <span className="text-base font-bold leading-none tabular-nums" style={{ color }}>
                  {client.daysSinceLastCall}
                </span>
                <span className="mt-0.5 text-[9px] font-medium text-muted-2">días</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{client.name}</p>
                <p className="truncate text-[10px] text-muted-2">
                  {client.coachNames.length > 0 ? client.coachNames.join(", ") : "Sin coach asignado"}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
