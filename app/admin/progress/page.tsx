import Link from "next/link";
import type { ReactNode } from "react";
import { getClientsList, getCoachesWithClients, type ClientListRow } from "@/lib/data/admin";
import { PageHeader, StatCard, EmptyState, SectionLabel } from "@/components/ui";
import { ClientProgressRow } from "@/components/client-progress-timeline";
import { getCadenceStatus, getProgramProgress } from "@/lib/program-dates";

function KanbanColumn({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-[320px] shrink-0 flex-col rounded-xl bg-surface-muted/60 p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted-2">{count}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {count === 0 ? (
          <p className="px-1 text-xs text-muted-2">Sin clientes aquí.</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

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

  const byRemaining = (a: (typeof withCadence)[number], b: (typeof withCadence)[number]) =>
    (a.progress?.daysRemaining ?? Infinity) - (b.progress?.daysRemaining ?? Infinity);

  // Cuatro columnas, estilo Trello, cada cliente cae en exactamente una según
  // su situación actual — el 100% manda primero (el programa ya se cumplió,
  // sin importar la cadencia), después atrasados, después por terminar.
  const completedColumn = withCadence.filter((c) => c.progress?.percentElapsed === 100).sort(byRemaining);
  const behindColumn = withCadence
    .filter((c) => c.progress?.percentElapsed !== 100 && c.cadence.behind)
    .sort(byRemaining);
  const nearingEndColumn = withCadence
    .filter((c) => c.progress?.percentElapsed !== 100 && !c.cadence.behind && (c.progress?.daysRemaining ?? Infinity) <= 15)
    .sort(byRemaining);
  const onTrackColumn = withCadence
    .filter(
      (c) =>
        c.progress?.percentElapsed !== 100 &&
        !c.cadence.behind &&
        (c.progress ? c.progress.daysRemaining > 15 : true)
    )
    .sort(byRemaining);

  function renderCard({ client }: { client: ClientListRow }) {
    return <ClientProgressRow key={client.id} client={client} href={`/admin/clients/${client.id}`} />;
  }

  return (
    <div>
      <PageHeader
        title="Progreso de clientes"
        description="Un tablero por categoría: quién está atrasado, quién está por terminar, y quién va bien."
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

      {withCadence.length === 0 ? (
        <EmptyState title="Sin clientes en curso" description="Ajusta el filtro de coach." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          <KanbanColumn title="Sin llamada esta semana" count={behindColumn.length} color="#d68552">
            {behindColumn.map(renderCard)}
          </KanbanColumn>

          <KanbanColumn title="Por terminar pronto" count={nearingEndColumn.length} color="#d68552">
            {nearingEndColumn.map(renderCard)}
          </KanbanColumn>

          <KanbanColumn title="En curso" count={onTrackColumn.length} color="#4c7c7e">
            {onTrackColumn.map(renderCard)}
          </KanbanColumn>

          <KanbanColumn title="Completados al 100%" count={completedColumn.length} color="#1f7a4c">
            {completedColumn.map(renderCard)}
          </KanbanColumn>
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
