import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCoachesWithClients, getCoachCallCounts } from "@/lib/data/admin";
import { PageHeader, Card, EmptyState, SectionLabel } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { ProgramAlertBadge } from "@/components/program-alert-badge";

function parseMonth(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  if (!match) return { year: now.getFullYear(), monthIndex: now.getMonth() };
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 };
}

function monthParam(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function addMonths(year: number, monthIndex: number, amount: number) {
  const date = new Date(Date.UTC(year, monthIndex + amount, 1, 12));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

function monthLabel(year: number, monthIndex: number) {
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthIndex, 1, 12))
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Mes calendario completo en horario Bogotá (igual que el calendario semanal).
function bogotaMonthRange(year: number, monthIndex: number) {
  return {
    from: new Date(Date.UTC(year, monthIndex, 1, 5)).toISOString(),
    to: new Date(Date.UTC(year, monthIndex + 1, 1, 5)).toISOString(),
  };
}

export default async function AdminCoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, monthIndex } = parseMonth(params.month);
  const range = bogotaMonthRange(year, monthIndex);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && monthIndex === now.getMonth();
  const previous = addMonths(year, monthIndex, -1);
  const next = addMonths(year, monthIndex, 1);

  const [coaches, callCounts] = await Promise.all([getCoachesWithClients(), getCoachCallCounts(range)]);
  const sortedCounts = [...callCounts].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...sortedCounts.map((c) => c.count));
  const totalCalls = sortedCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div>
      <PageHeader title="Coaches" description={`${coaches.length} coaches`} />

      <Card className="mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionLabel>Llamadas por coach · solo admin</SectionLabel>
            <p className="text-xs text-muted-2">Para verificar pagos — se actualiza solo con cada llamada nueva.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/coaches?month=${monthParam(previous.year, previous.monthIndex)}`}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-surface-muted"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
            <span className="min-w-[140px] text-center text-sm font-semibold text-foreground">
              {monthLabel(year, monthIndex)}
            </span>
            <Link
              href={`/admin/coaches?month=${monthParam(next.year, next.monthIndex)}`}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-surface-muted"
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
            {!isCurrentMonth && (
              <Link
                href={`/admin/coaches?month=${monthParam(now.getFullYear(), now.getMonth())}`}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-muted"
              >
                Hoy
              </Link>
            )}
          </div>
        </div>

        {sortedCounts.length === 0 ? (
          <EmptyState title="Sin coaches activos" />
        ) : (
          <div className="space-y-2.5">
            {sortedCounts.map((c) => (
              <div key={c.coachId} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm font-medium text-foreground">{c.name}</span>
                <div className="h-2.5 flex-1 rounded-full bg-[--border]">
                  <div
                    className="h-2.5 rounded-full bg-accent transition-all"
                    style={{ width: `${Math.max((c.count / maxCount) * 100, c.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                  {c.count}
                </span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted-2">
              <span>Total del mes</span>
              <span className="font-semibold tabular-nums text-foreground">{totalCalls}</span>
            </div>
          </div>
        )}
      </Card>

      {coaches.length === 0 ? (
        <EmptyState title="Sin coaches registrados" />
      ) : (
        <div className="space-y-5">
          {coaches.map((coach) => (
            <Card key={coach.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {coach.full_name || coach.email}
                  </h2>
                  <p className="text-sm text-muted">{coach.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!coach.is_active && (
                    <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                      Inactivo
                    </span>
                  )}
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                    {coach.clients.length} clientes
                  </span>
                </div>
              </div>

              {coach.clients.length > 0 && (
                <div className="mt-4 space-y-4">
                  {(
                    [
                      ["Clientes activos", coach.clients.filter((c) => c.status !== "inactive")],
                      ["Clientes finalizados", coach.clients.filter((c) => c.status === "inactive")],
                    ] as const
                  ).map(([label, list]) =>
                    list.length > 0 ? (
                      <div key={label}>
                        <SectionLabel>
                          {label} ({list.length})
                        </SectionLabel>
                        <ul className="divide-y divide-border">
                          {list.map((client) => (
                            <li key={client.id} className="flex items-center justify-between py-2 text-sm">
                              <Link
                                href={`/admin/clients/${client.id}`}
                                className="font-medium text-foreground hover:text-accent"
                              >
                                {client.full_name || client.email}
                              </Link>
                              <span className="flex items-center gap-2">
                                <ProgramAlertBadge status={client.status} end_date={client.end_date} />
                                <StatusBadge status={client.status} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
