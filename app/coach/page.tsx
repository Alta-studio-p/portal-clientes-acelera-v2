import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getCoachByProfileId } from "@/lib/data/client-detail";
import { getClientsForCoach, type CoachClientRow } from "@/lib/data/coach";
import { PageHeader, Card, EmptyState, SectionLabel } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { ProgramAlertBadge } from "@/components/program-alert-badge";
import { formatDate } from "@/lib/format";
import { getProgramAlert } from "@/lib/program-dates";

function ClientsTable({ clients }: { clients: CoachClientRow[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted-2">
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Fecha final</th>
            <th className="px-4 py-3">Llamadas</th>
            <th className="px-4 py-3">Última llamada</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {clients.map((client) => {
            const alert = getProgramAlert(client);
            return (
              <tr
                key={client.id}
                className={`hover:bg-surface-muted ${alert ? "border-l-4 border-l-[--alert-warning]" : ""}`}
              >
                <td className="px-4 py-3">
                  <Link href={`/coach/clients/${client.id}`} className="block">
                    <p className="font-medium text-foreground">{client.full_name || client.email}</p>
                    <p className="text-xs text-muted-2">{client.email}</p>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={client.status} />
                </td>
                <td className="px-4 py-3">
                  <p className={alert ? "font-medium text-[--alert-warning]" : "text-muted"}>
                    {client.end_date ? formatDate(client.end_date) : "—"}
                  </p>
                  <ProgramAlertBadge status={client.status} end_date={client.end_date} />
                </td>
                <td className="px-4 py-3 text-muted">{client.call_count}</td>
                <td className="px-4 py-3 text-muted">{formatDate(client.last_call_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export default async function CoachHomePage() {
  const { userId } = await requireRole(["coach"]);
  const coach = await getCoachByProfileId(userId);
  const clients = coach ? await getClientsForCoach(coach.id) : [];

  const activeClients = clients.filter((c) => c.status !== "inactive");
  const closedClients = clients.filter((c) => c.status === "inactive");

  return (
    <div>
      <PageHeader title="Mis clientes" description={`${clients.length} clientes asignados`} />

      {clients.length === 0 ? (
        <EmptyState
          title="Sin clientes asignados"
          description="Cuando Acelera te asigne clientes, aparecerán aquí."
        />
      ) : (
        <div className="space-y-6">
          <div>
            <SectionLabel>Clientes activos ({activeClients.length})</SectionLabel>
            {activeClients.length === 0 ? (
              <EmptyState title="Sin clientes activos" />
            ) : (
              <ClientsTable clients={activeClients} />
            )}
          </div>

          <div>
            <SectionLabel>Clientes finalizados ({closedClients.length})</SectionLabel>
            {closedClients.length === 0 ? (
              <EmptyState title="Sin clientes finalizados" />
            ) : (
              <ClientsTable clients={closedClients} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
