import Link from "next/link";
import { getClientsList, getCoachesWithClients } from "@/lib/data/admin";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { AddClientForm } from "./add-client-form";
import type { ClientStatus } from "@/lib/supabase/types";

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "extension", label: "Extensión" },
];

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ coach?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = STATUS_OPTIONS.some((o) => o.value === params.status)
    ? (params.status as ClientStatus)
    : undefined;

  const [clients, coaches] = await Promise.all([
    getClientsList({ coachId: params.coach, status, search: params.q }),
    getCoachesWithClients(),
  ]);

  return (
    <div>
      <PageHeader
        title="Clientes"
        description={`${clients.length} clientes`}
        actions={<AddClientForm coaches={coaches} />}
      />

      <form className="mb-5 flex flex-wrap gap-3" action="/admin/clients">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nombre o correo…"
          className="w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          name="coach"
          defaultValue={params.coach ?? ""}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="">Todos los coaches</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || c.email}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Filtrar
        </button>
        {(params.coach || params.status || params.q) && (
          <Link
            href="/admin/clients"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Limpiar
          </Link>
        )}
      </form>

      {clients.length === 0 ? (
        <EmptyState title="Sin resultados" description="Ajusta los filtros o la búsqueda." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-2">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Coach(es)</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Llamadas</th>
                <th className="px-4 py-3">Última llamada</th>
                <th className="px-4 py-3">Drive</th>
                <th className="px-4 py-3">Contexto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${client.id}`} className="block">
                      <p className="font-medium text-foreground">
                        {client.full_name || client.email}
                      </p>
                      <p className="text-xs text-muted-2">{client.email}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {client.coach_names.length ? client.coach_names.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={client.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">{client.call_count}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(client.last_call_at)}</td>
                  <td className="px-4 py-3">
                    {client.drive_folder_url ? (
                      <span className="text-xs font-medium text-[--status-active]">Sí</span>
                    ) : (
                      <span className="text-xs font-medium text-muted-2">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {client.context_summary ? (
                      <span className="text-xs font-medium text-[--status-active]">Sí</span>
                    ) : (
                      <span className="text-xs font-medium text-muted-2">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
