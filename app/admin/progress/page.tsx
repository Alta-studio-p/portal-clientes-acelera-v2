import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getClientsList, getCoachesWithClients } from "@/lib/data/admin";
import { PageHeader, StatCard, Card, EmptyState, SectionLabel } from "@/components/ui";
import { ClientProgressRow } from "@/components/client-progress-timeline";
import { getCadenceStatus, getProgramProgress } from "@/lib/program-dates";
import { initials } from "@/lib/format";

export default async function AdminProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ coach?: string }>;
}) {
  const params = await searchParams;

  const [allClients, coaches] = await Promise.all([
    getClientsList({ coachId: params.coach }),
    getCoachesWithClients(),
  ]);

  const inProgress = allClients.filter((c) => c.status === "active" || c.status === "extension");
  const finished = allClients.filter((c) => c.status === "inactive");

  const withCadence = inProgress.map((client) => ({
    client,
    cadence: getCadenceStatus({ status: client.status, start_date: client.start_date, last_call_at: client.last_call_at }),
    progress: getProgramProgress(client),
  }));

  const behindCount = withCadence.filter((c) => c.cadence.behind).length;
  const nearingEndCount = withCadence.filter((c) => c.progress && c.progress.daysRemaining <= 15).length;

  const sorted = [...withCadence].sort((a, b) => {
    if (a.cadence.behind !== b.cadence.behind) return a.cadence.behind ? -1 : 1;
    const aRemaining = a.progress?.daysRemaining ?? Infinity;
    const bRemaining = b.progress?.daysRemaining ?? Infinity;
    return aRemaining - bRemaining;
  });

  // Un cliente con el programa al 100% ya terminó lo que tenía que hacer —
  // se muestra aparte como lista, no como tarjeta de seguimiento activo.
  const completed = sorted.filter((c) => c.progress?.percentElapsed === 100);
  const inFlight = sorted.filter((c) => c.progress?.percentElapsed !== 100);

  return (
    <div>
      <PageHeader
        title="Progreso de clientes"
        description="Mapa visual de todos los programas en curso: sesiones que hubo, cuánto falta, y quién se atrasó."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="En curso" value={inProgress.length} tone="accent" />
        <StatCard
          label="Sin llamada esta semana"
          value={behindCount}
          hint="Más de 9 días sin sesión"
          tone={behindCount > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Por terminar pronto"
          value={nearingEndCount}
          hint="15 días o menos"
          tone={nearingEndCount > 0 ? "warning" : undefined}
        />
      </div>

      <form className="mb-5 flex flex-wrap gap-3" action="/admin/progress">
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
        {params.coach && (
          <Link
            href="/admin/progress"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Limpiar
          </Link>
        )}
      </form>

      {sorted.length === 0 ? (
        <EmptyState title="Sin clientes en curso" description="Ajusta el filtro de coach." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inFlight.map(({ client }) => (
              <ClientProgressRow key={client.id} client={client} href={`/admin/clients/${client.id}`} />
            ))}
          </div>

          <Card className="h-fit p-4 lg:sticky lg:top-20">
            <SectionLabel>Completados al 100% ({completed.length})</SectionLabel>
            {completed.length === 0 ? (
              <p className="text-sm text-muted-2">Ningún cliente en curso llegó al 100% todavía.</p>
            ) : (
              <ul className="space-y-1">
                {completed.map(({ client }) => (
                  <li key={client.id}>
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-surface-muted"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[--status-active-bg] text-xs font-semibold text-[--status-active]">
                        {initials(client.full_name, client.email)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {client.full_name || client.email}
                      </span>
                      <CheckCircle2
                        size={16}
                        strokeWidth={2}
                        className="shrink-0 text-[--status-active]"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="mt-6">
        <SectionLabel>Finalizados ({finished.length})</SectionLabel>
        <Link href="/admin/clients?status=inactive" className="text-sm font-medium text-accent hover:underline">
          Ver clientes finalizados en la tabla completa →
        </Link>
      </div>
    </div>
  );
}
