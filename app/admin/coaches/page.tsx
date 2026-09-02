import Link from "next/link";
import { getCoachesWithClients } from "@/lib/data/admin";
import { PageHeader, Card, EmptyState, SectionLabel } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { ProgramAlertBadge } from "@/components/program-alert-badge";

export default async function AdminCoachesPage() {
  const coaches = await getCoachesWithClients();

  return (
    <div>
      <PageHeader title="Coaches" description={`${coaches.length} coaches`} />

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
