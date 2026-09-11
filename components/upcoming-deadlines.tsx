import Link from "next/link";

export interface UpcomingDeadlineClient {
  id: string;
  name: string;
  percent: number;
  daysRemaining: number;
}

const ACCENT = "#4c7c7e";
const ALERT_WARNING = "#d68552";

export function UpcomingDeadlines({ clients }: { clients: UpcomingDeadlineClient[] }) {
  if (clients.length === 0) {
    return <p className="text-sm text-muted-2">Sin clientes con fecha de finalización configurada.</p>;
  }

  return (
    <ul className="space-y-2">
      {clients.map((client) => {
        const urgent = client.daysRemaining <= 15;
        return (
          <li key={client.id}>
            <Link
              href={`/admin/clients/${client.id}`}
              className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{client.name}</p>
                <div className="mt-1 h-1.5 rounded-full bg-[--border]">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${Math.max(client.percent, 3)}%`, backgroundColor: ACCENT }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className="text-sm font-bold leading-none tabular-nums text-foreground"
                  style={urgent ? { color: ALERT_WARNING } : undefined}
                >
                  {client.daysRemaining < 0 ? "Vencido" : `${client.daysRemaining}d`}
                </p>
                <p className="mt-1 text-[10px] text-muted-2">{client.percent}% avance</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
