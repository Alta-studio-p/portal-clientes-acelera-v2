import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { EmptyState, PageHeader, SectionLabel } from "@/components/ui";
import { getClientsList, getCoachesWithClients, type ClientListRow } from "@/lib/data/admin";
import { formatDate } from "@/lib/format";
import { getCadenceStatus, getProgramProgress, type CadenceStatus, type ProgramProgress } from "@/lib/program-dates";

type ClientWithProgress = {
  client: ClientListRow;
  cadence: CadenceStatus;
  progress: ProgramProgress | null;
};

function clientName(client: ClientListRow) {
  return client.full_name || client.email;
}

function coachName(client: ClientListRow) {
  return client.coach_names.length > 0 ? client.coach_names.join(", ") : "Sin coach";
}

function shortCoachName(coach: { full_name: string | null; email: string }) {
  const fullName = coach.full_name?.trim();
  return fullName ? fullName.split(/\s+/)[0] : coach.email;
}

function remainingLabel(progress: ProgramProgress | null) {
  if (!progress) return "—";
  if (progress.daysRemaining < 0) return "Finalizó";
  if (progress.daysRemaining === 0) return "Hoy";
  return `${progress.daysRemaining} día${progress.daysRemaining === 1 ? "" : "s"}`;
}

function progressValue(item: ClientWithProgress, completed: boolean) {
  return completed ? 100 : item.progress?.percentElapsed ?? null;
}

function statusContent(item: ClientWithProgress) {
  if (item.cadence.behind) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-[--alert-warning]">
        <TriangleAlert size={14} strokeWidth={2.5} aria-hidden="true" />
        Sin llamada hace {item.cadence.daysSinceLastCall} días
      </span>
    );
  }

  if (item.progress && item.progress.daysRemaining <= 15) {
    return <span className="font-medium text-[--alert-warning]">Termina pronto</span>;
  }

  return <span className="font-medium text-[--status-active]">En curso</span>;
}

function ProgressBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-2">Sin fechas</span>;

  return (
    <div className="flex min-w-[124px] items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(value, 3)}%` }} />
      </div>
      <span className="w-9 text-right font-semibold tabular-nums text-foreground">{value}%</span>
    </div>
  );
}

function ActiveClientsTable({ clients, showCoach }: { clients: ClientWithProgress[]; showCoach: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="border-b border-border bg-surface-muted/60 text-xs font-medium text-muted">
          <tr>
            <th className="px-4 py-3">Cliente</th>
            {showCoach && <th className="px-4 py-3">Coach</th>}
            <th className="px-4 py-3">Progreso</th>
            <th className="px-4 py-3 text-right">Sesiones</th>
            <th className="px-4 py-3">Última llamada</th>
            <th className="px-4 py-3">Faltan</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {clients.map((item) => (
            <tr key={item.client.id} className="transition hover:bg-surface-muted/40">
              <td className="px-4 py-3">
                <Link href={`/admin/clients/${item.client.id}`} className="block max-w-[220px] truncate font-medium text-foreground hover:text-accent">
                  {clientName(item.client)}
                </Link>
              </td>
              {showCoach && <td className="max-w-[150px] truncate px-4 py-3 text-muted">{coachName(item.client)}</td>}
              <td className="px-4 py-3"><ProgressBar value={progressValue(item, false)} /></td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">{item.client.call_count}</td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(item.client.last_call_at)}</td>
              <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums text-foreground">{remainingLabel(item.progress)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-xs">{statusContent(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompletedClientsTable({ clients, showCoach }: { clients: ClientWithProgress[]; showCoach: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[600px] border-collapse text-left text-sm">
        <thead className="border-b border-border bg-surface-muted/60 text-xs font-medium text-muted">
          <tr>
            <th className="px-4 py-3">Cliente</th>
            {showCoach && <th className="px-4 py-3">Coach</th>}
            <th className="px-4 py-3">Progreso</th>
            <th className="px-4 py-3 text-right">Sesiones</th>
            <th className="px-4 py-3">Fecha de finalización</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {clients.map((item) => (
            <tr key={item.client.id} className="transition hover:bg-surface-muted/40">
              <td className="px-4 py-3">
                <Link href={`/admin/clients/${item.client.id}`} className="block max-w-[250px] truncate font-medium text-foreground hover:text-accent">
                  {clientName(item.client)}
                </Link>
              </td>
              {showCoach && <td className="max-w-[170px] truncate px-4 py-3 text-muted">{coachName(item.client)}</td>}
              <td className="px-4 py-3"><ProgressBar value={progressValue(item, true)} /></td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">{item.client.call_count}</td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(item.client.end_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ coach?: string }>;
}) {
  const params = await searchParams;
  const selectedCoachId = params.coach || undefined;

  const [allClients, coaches] = await Promise.all([
    getClientsList({ coachId: selectedCoachId }),
    getCoachesWithClients(),
  ]);

  const clients = allClients.map((client) => ({
    client,
    cadence: getCadenceStatus({ status: client.status, start_date: client.start_date, last_call_at: client.last_call_at }),
    progress: getProgramProgress(client),
  }));

  // Un cliente inactivo o cuyo programa llegó al 100% se mantiene visible en
  // "Completados". Así no desaparecen los finalizados del coach que los atendió.
  const completed = clients
    .filter((item) => item.client.status === "inactive" || item.progress?.percentElapsed === 100)
    .sort((a, b) => (b.client.end_date ?? "").localeCompare(a.client.end_date ?? ""));
  const active = clients
    .filter((item) => !completed.includes(item))
    .sort((a, b) => {
      const aGroup = a.cadence.behind ? 0 : (a.progress?.daysRemaining ?? Infinity) <= 15 ? 1 : 2;
      const bGroup = b.cadence.behind ? 0 : (b.progress?.daysRemaining ?? Infinity) <= 15 ? 1 : 2;
      if (aGroup !== bGroup) return aGroup - bGroup;
      return (a.progress?.daysRemaining ?? Infinity) - (b.progress?.daysRemaining ?? Infinity);
    });

  const requiringAttention = active.filter((item) => item.cadence.behind).length;
  const nearingEnd = active.filter((item) => (item.progress?.daysRemaining ?? Infinity) <= 15).length;
  const selectedCoach = coaches.find((coach) => coach.id === selectedCoachId);
  const selectedCoachName = selectedCoach ? shortCoachName(selectedCoach) : undefined;
  const showCoach = !selectedCoachId;

  return (
    <div>
      <PageHeader
        title="Progreso de clientes"
        description="Una vista compacta para revisar la operación por coach y detectar prioridades."
      />

      <div className="mb-6 grid overflow-hidden rounded-xl border border-border bg-surface sm:grid-cols-4 sm:divide-x sm:divide-border">
        {[
          ["Clientes activos", active.length, "text-accent"],
          ["Requieren atención", requiringAttention, requiringAttention > 0 ? "text-[--alert-warning]" : "text-foreground"],
          ["Por terminar pronto", nearingEnd, nearingEnd > 0 ? "text-[--alert-warning]" : "text-foreground"],
          ["Completados", completed.length, "text-[--status-active]"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="border-b border-border px-4 py-3 last:border-b-0 sm:border-b-0">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <nav aria-label="Filtrar progreso por coach" className="mb-7 flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/admin/progress"
          aria-current={!selectedCoachId ? "page" : undefined}
          className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${!selectedCoachId ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:border-accent hover:text-accent"}`}
        >
          Todos
        </Link>
        {coaches.map((coach) => {
          const isSelected = coach.id === selectedCoachId;
          const name = shortCoachName(coach);
          return (
            <Link
              key={coach.id}
              href={`/admin/progress?coach=${encodeURIComponent(coach.id)}`}
              aria-current={isSelected ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${isSelected ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:border-accent hover:text-accent"}`}
            >
              {name}
            </Link>
          );
        })}
      </nav>

      {selectedCoachName && (
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">{selectedCoachName}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {clients.length} cliente{clients.length === 1 ? "" : "s"} · {active.length} en curso · {completed.length} completado{completed.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      {clients.length === 0 ? (
        <EmptyState
          title={selectedCoachName ? `Sin clientes para ${selectedCoachName}` : "Sin clientes registrados"}
          description="Los clientes asignados aparecerán aquí cuando estén disponibles."
        />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="en-curso">
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel><span id="en-curso">En curso ({active.length})</span></SectionLabel>
              {requiringAttention > 0 && <span className="text-xs font-medium text-[--alert-warning]">{requiringAttention} requieren atención</span>}
            </div>
            {active.length > 0 ? (
              <ActiveClientsTable clients={active} showCoach={showCoach} />
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-sm text-muted">No hay clientes en curso.</div>
            )}
          </section>

          <section aria-labelledby="completados">
            <SectionLabel><span id="completados">Completados ({completed.length})</span></SectionLabel>
            {completed.length > 0 ? (
              <CompletedClientsTable clients={completed} showCoach={showCoach} />
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-sm text-muted">No hay clientes completados todavía.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
