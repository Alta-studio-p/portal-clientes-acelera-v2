import Link from "next/link";
import { getAdminCounts, getCallsNeedingAttention } from "@/lib/data/admin";
import { PageHeader, StatCard, Card, EmptyState, SectionLabel } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { displayCallTitle } from "@/lib/call-title";

export default async function AdminHomePage() {
  const [counts, attentionCalls] = await Promise.all([
    getAdminCounts(),
    getCallsNeedingAttention(),
  ]);

  return (
    <div>
      <PageHeader
        title="Resumen general"
        description="Vista consolidada de clientes, coaches y llamadas."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Clientes" value={counts.clients} />
        <StatCard label="Coaches" value={counts.coaches} />
        <StatCard label="Llamadas" value={counts.calls} />
        <StatCard label="Llamadas con resumen" value={counts.callsWithSummary} />
        <StatCard label="Clientes con contexto" value={counts.clientsWithContext} />
      </div>

      <div className="mt-8">
        <SectionLabel>Llamadas que requieren atención</SectionLabel>
        {attentionCalls.length === 0 ? (
          <EmptyState
            title="Todo en orden"
            description="No hay llamadas sin resumen ni sin cliente asignado."
          />
        ) : (
          <Card className="divide-y divide-border p-0">
            {attentionCalls.map((call) => (
              <div key={call.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{displayCallTitle(call)}</p>
                  <p className="text-xs text-muted-2">{formatDate(call.started_at)}</p>
                </div>
                <div className="flex gap-2">
                  {!call.summary && (
                    <span className="rounded-full bg-[--status-extension-bg] px-2.5 py-0.5 text-xs font-medium text-[--status-extension]">
                      Sin resumen
                    </span>
                  )}
                  {!call.client_id && (
                    <span className="rounded-full bg-[--danger-bg] px-2.5 py-0.5 text-xs font-medium text-[--danger]">
                      Sin cliente
                    </span>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/admin/clients"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Ver todos los clientes
        </Link>
        <Link
          href="/admin/coaches"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Ver coaches
        </Link>
      </div>
    </div>
  );
}
