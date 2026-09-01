import Link from "next/link";
import { FathomMonthCalendar, type FathomMonthCell } from "@/components/fathom-month-calendar";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { getAdminFathomCalendarDashboard } from "@/lib/data/admin";

function parseMonth(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  if (!match) {
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }

  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
  };
}

function monthParam(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function addMonths(year: number, monthIndex: number, amount: number) {
  const date = new Date(Date.UTC(year, monthIndex + amount, 1, 12));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

function monthLabel(year: number, monthIndex: number) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1, 12)));
}

function bogotaMonthRange(year: number, monthIndex: number) {
  return {
    from: new Date(Date.UTC(year, monthIndex, 1, 5)).toISOString(),
    to: new Date(Date.UTC(year, monthIndex + 1, 1, 5)).toISOString(),
  };
}

function dateKeyFromParts(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthCells(year: number, monthIndex: number) {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, monthIndex, 1, 12)).getUTCDay();
  const leadingEmpty = firstDay === 0 ? 6 : firstDay - 1;
  const cells: FathomMonthCell[] = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
    cells.push({ key: `empty-start-${index}`, day: null, dateKey: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: dateKeyFromParts(year, monthIndex, day), day, dateKey: dateKeyFromParts(year, monthIndex, day) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `empty-end-${cells.length}`, day: null, dateKey: null });
  }

  return cells;
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; coach?: string }>;
}) {
  const params = await searchParams;
  const { year, monthIndex } = parseMonth(params.month);
  const range = bogotaMonthRange(year, monthIndex);
  const cells = buildMonthCells(year, monthIndex);

  const dashboard = await getAdminFathomCalendarDashboard({
    from: range.from,
    to: range.to,
    coachId: params.coach || undefined,
  });

  const selectedCoachId = dashboard.selectedCoach?.id ?? params.coach ?? "";
  const summarizedCalls = dashboard.calls.filter((call) => call.summary).length;
  const callsWithoutClient = dashboard.calls.filter((call) => !call.client_id).length;
  const uniqueClients = new Set(dashboard.calls.map((call) => call.client_id).filter(Boolean)).size;
  const previous = addMonths(year, monthIndex, -1);
  const next = addMonths(year, monthIndex, 1);
  const coachParam = selectedCoachId ? `&coach=${selectedCoachId}` : "";

  return (
    <div>
      <PageHeader
        title="Calendario de Fathom"
        description={
          dashboard.selectedCoach
            ? `${dashboard.selectedCoach.full_name || dashboard.selectedCoach.email} · ${monthLabel(
                year,
                monthIndex
              )}`
            : "Selecciona un coach para ver sus llamadas grabadas"
        }
        actions={
          <>
            <Link
              href={`/admin/calendar?month=${monthParam(previous.year, previous.monthIndex)}${coachParam}`}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Mes anterior
            </Link>
            <Link
              href={`/admin/calendar?month=${monthParam(next.year, next.monthIndex)}${coachParam}`}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Mes siguiente
            </Link>
          </>
        }
      />

      <form className="mb-5 flex flex-wrap items-end gap-3" action="/admin/calendar">
        <div>
          <label htmlFor="coach" className="mb-1 block text-xs font-medium text-muted-2">
            Coach
          </label>
          <select
            id="coach"
            name="coach"
            defaultValue={selectedCoachId}
            className="min-w-56 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            {dashboard.coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.full_name || coach.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="month" className="mb-1 block text-xs font-medium text-muted-2">
            Mes
          </label>
          <input
            id="month"
            name="month"
            type="month"
            defaultValue={monthParam(year, monthIndex)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Ver calendario
        </button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Grabadas" value={dashboard.calls.length} />
        <StatCard label="Con resumen" value={summarizedCalls} />
        <StatCard label="Clientes atendidos" value={uniqueClients} />
        <StatCard label="Sin cliente" value={callsWithoutClient} />
      </div>

      {!dashboard.selectedCoach ? (
        <EmptyState title="No hay coaches activos" description="Activa o crea coaches para ver el calendario." />
      ) : (
        <Card className="p-5">
          <FathomMonthCalendar cells={cells} calls={dashboard.calls} />
        </Card>
      )}

      {dashboard.selectedCoach && dashboard.calls.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Sin llamadas grabadas este mes"
            description="Si el coach tuvo sesiones, esta vista ayuda a detectar que faltó grabarlas en Fathom."
          />
        </div>
      )}
    </div>
  );
}
