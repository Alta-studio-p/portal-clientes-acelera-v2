import Link from "next/link";
import {
  getAdminAnalytics,
  getAdminCounts,
  getCallsNeedingAttention,
  getClientsList,
} from "@/lib/data/admin";
import { PageHeader, StatCard, Card, EmptyState, SectionLabel } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { displayCallTitle } from "@/lib/call-title";
import { DailyCallsChart } from "@/components/charts/daily-calls-chart";
import { StatusBreakdownChart } from "@/components/charts/status-breakdown-chart";
import { ProgressHeatmap } from "@/components/progress-heatmap";
import { UpcomingDeadlines } from "@/components/upcoming-deadlines";
import { getProgramProgress } from "@/lib/program-dates";

const RANGE_OPTIONS = [
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
];

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = RANGE_OPTIONS.some((o) => String(o.value) === params.days) ? Number(params.days) : 30;

  const [counts, attentionCalls, analytics, clients] = await Promise.all([
    getAdminCounts(),
    getCallsNeedingAttention(),
    getAdminAnalytics({ days }),
    getClientsList({}),
  ]);

  const avgPerDay = (analytics.totalCallsInRange / days).toFixed(1);

  const inProgressWithDates = clients
    .filter((c) => c.status === "active" || c.status === "extension")
    .map((c) => ({ id: c.id, name: c.full_name || c.email, progress: getProgramProgress(c) }))
    .filter((c): c is { id: string; name: string; progress: NonNullable<typeof c.progress> } => c.progress !== null)
    .filter((c) => c.progress.percentElapsed < 100);

  const topProgress = [...inProgressWithDates]
    .sort((a, b) => b.progress.percentElapsed - a.progress.percentElapsed)
    .slice(0, 16)
    .map((c) => ({ id: c.id, name: c.name, percent: c.progress.percentElapsed }));

  // Lo que más le importa a Luciano: quién está más cerca de terminar su
  // programa y cómo va de progreso — no cuántas llamadas tuvo cada coach.
  const upcomingDeadlines = [...inProgressWithDates]
    .sort((a, b) => a.progress.daysRemaining - b.progress.daysRemaining)
    .slice(0, 8)
    .map((c) => ({ id: c.id, name: c.name, percent: c.progress.percentElapsed, daysRemaining: c.progress.daysRemaining }));

  return (
    <div>
      <PageHeader
        title="Resumen general"
        description="Vista consolidada de clientes, coaches y llamadas."
        actions={
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              { label: "Clientes", value: counts.clients },
              { label: "Coaches", value: counts.coaches },
              { label: "Llamadas", value: counts.calls },
              { label: "Con resumen", value: counts.callsWithSummary },
              { label: "Con contexto", value: counts.clientsWithContext },
            ].map((s) => (
              <div key={s.label} className="text-right">
                <p className="text-2xl font-bold leading-none tabular-nums text-accent">{s.value}</p>
                <p className="mt-1 text-[11px] font-medium text-muted-2">{s.label}</p>
              </div>
            ))}
          </div>
        }
      />

      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>Tendencia</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((o) => (
              <Link
                key={o.value}
                href={`/admin?days=${o.value}`}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  days === o.value
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted hover:bg-surface-muted"
                }`}
              >
                {o.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={`Llamadas en ${days} días`} value={analytics.totalCallsInRange} tone="accent" />
          <StatCard label="Promedio por día" value={avgPerDay} />
          <StatCard label="Coaches activos" value={analytics.coachCalls.length} />
          <StatCard label="Clientes totales" value={counts.clients} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5 lg:col-span-2">
            <SectionLabel>Llamadas por día</SectionLabel>
            <DailyCallsChart data={analytics.dailyCalls} coaches={analytics.coachCalls} />
          </Card>

          <Card className="p-5">
            <SectionLabel>Próximos a finalizar</SectionLabel>
            <UpcomingDeadlines clients={upcomingDeadlines} />
          </Card>

          <Card className="p-5">
            <SectionLabel>Clientes por estado</SectionLabel>
            <StatusBreakdownChart data={analytics.statusBreakdown} />

            <div className="mt-5 border-t border-border pt-4">
              <SectionLabel>Mayor progreso</SectionLabel>
              <ProgressHeatmap clients={topProgress} />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-10">
        <SectionLabel>Llamadas que requieren atención</SectionLabel>
        {attentionCalls.length === 0 ? (
          <EmptyState
            title="Todo en orden"
            description="No hay llamadas sin resumen ni sin cliente asignado."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attentionCalls.map((call) => {
              const badges = (
                <div className="mt-3 flex flex-wrap gap-1.5">
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
              );

              const content = (
                <>
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {displayCallTitle(call)}
                  </p>
                  <p className="mt-1 text-xs text-muted-2">{formatDate(call.started_at)}</p>
                  {badges}
                </>
              );

              return call.client_id ? (
                <Link
                  key={call.id}
                  href={`/admin/clients/${call.client_id}?call=${call.id}`}
                  className="rounded-xl border border-border bg-surface p-4 transition hover:border-accent/60 hover:shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)]"
                >
                  {content}
                </Link>
              ) : (
                <div key={call.id} className="rounded-xl border border-border bg-surface p-4">
                  {content}
                </div>
              );
            })}
          </div>
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
