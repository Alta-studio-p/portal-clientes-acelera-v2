import Link from "next/link";
import {
  getAdminAnalytics,
  getAdminCounts,
  getClientsList,
} from "@/lib/data/admin";
import { PageHeader, StatCard, Card, SectionLabel } from "@/components/ui";
import { getCallAssignmentQueue } from '@/lib/data/call-assignment';
import { CallAssignmentQueue } from '@/components/call-assignment-queue';
import { DailyCallsChart } from "@/components/charts/daily-calls-chart";
import { StatusBreakdownChart } from "@/components/charts/status-breakdown-chart";
import { UpcomingDeadlines } from "@/components/upcoming-deadlines";
import { BehindCadenceList } from "@/components/behind-cadence-list";
import { getCadenceStatus, getProgramProgress } from "@/lib/program-dates";

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

  const [counts, assignmentQueue, analytics, clients] = await Promise.all([
    getAdminCounts(),
    getCallAssignmentQueue(),
    getAdminAnalytics({ days }),
    getClientsList({}),
  ]);

  const avgPerDay = (analytics.totalCallsInRange / days).toFixed(1);

  const inProgressWithDates = clients
    .filter((c) => c.status === "active" || c.status === "extension")
    .map((c) => ({
      id: c.id,
      name: c.full_name || c.email,
      status: c.status,
      startDate: c.start_date,
      lastCallAt: c.last_call_at,
      progress: getProgramProgress(c),
    }))
    .filter(
      (c): c is typeof c & { progress: NonNullable<typeof c.progress> } => c.progress !== null
    )
    .filter((c) => c.progress.percentElapsed < 100);

  // Lo que más le importa a Luciano: quién está más cerca de terminar su
  // programa y cómo va de progreso — no cuántas llamadas tuvo cada coach.
  const upcomingDeadlines = [...inProgressWithDates]
    .sort((a, b) => a.progress.daysRemaining - b.progress.daysRemaining)
    .slice(0, 8)
    .map((c) => ({ id: c.id, name: c.name, percent: c.progress.percentElapsed, daysRemaining: c.progress.daysRemaining }));

  // Distinto de "próximos a finalizar": esto es sobre cadencia semanal, no
  // sobre fecha final — un cliente puede ir bien de tiempo pero llevar
  // semanas sin sesión, o viceversa. Solo clientes con progreso real
  // configurado (start_date/end_date) — así se filtran los casos raros de
  // datos (ej. un cliente con "1820 días sin llamada" y sin fechas de
  // programa, que no es un caso de seguimiento real sino un dato roto).
  const behindClients = inProgressWithDates
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      cadence: getCadenceStatus({ status: c.status, start_date: c.startDate, last_call_at: c.lastCallAt }),
    }))
    .filter((c) => c.cadence.behind)
    .sort((a, b) => (b.cadence.daysSinceLastCall ?? 0) - (a.cadence.daysSinceLastCall ?? 0))
    .slice(0, 16)
    .map((c) => ({ id: c.id, name: c.name, daysSinceLastCall: c.cadence.daysSinceLastCall ?? 0 }));

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
              <SectionLabel>Sin llamada esta semana</SectionLabel>
              <BehindCadenceList clients={behindClients} />
            </div>
          </Card>
        </div>
      </div>

      <CallAssignmentQueue {...assignmentQueue} role="admin" />

      <div className="mt-8 flex gap-3">
        <Link
          href="/admin/progress"
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
