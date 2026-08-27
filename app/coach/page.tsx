import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getCoachByProfileId } from "@/lib/data/client-detail";
import { getClientsForCoach } from "@/lib/data/coach";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";

export default async function CoachHomePage() {
  const { userId } = await requireRole(["coach"]);
  const coach = await getCoachByProfileId(userId);
  const clients = coach ? await getClientsForCoach(coach.id) : [];

  return (
    <div>
      <PageHeader title="Mis clientes" description={`${clients.length} clientes asignados`} />

      {clients.length === 0 ? (
        <EmptyState
          title="Sin clientes asignados"
          description="Cuando Acelera te asigne clientes, aparecerán aquí."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-2">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Llamadas</th>
                <th className="px-4 py-3">Última llamada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link href={`/coach/clients/${client.id}`} className="block">
                      <p className="font-medium text-foreground">{client.full_name || client.email}</p>
                      <p className="text-xs text-muted-2">{client.email}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={client.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">{client.call_count}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(client.last_call_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
