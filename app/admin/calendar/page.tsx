import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GoogleStyleCalendar, type CalendarCell } from "@/components/google-style-calendar";
import { EmptyState, PageHeader } from "@/components/ui";
import { getAdminMonthCalendar } from "@/lib/data/admin";

function parseMonth(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  if (!match) {
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 };
}

function monthParam(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function addMonths(year: number, monthIndex: number, amount: number) {
  const date = new Date(Date.UTC(year, monthIndex + amount, 1, 12));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

function monthLabel(year: number, monthIndex: number) {
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthIndex, 1, 12))
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
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

function buildMonthCells(year: number, monthIndex: number): CalendarCell[] {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, monthIndex, 1, 12)).getUTCDay();
  const leadingEmpty = firstDay === 0 ? 6 : firstDay - 1;
  const todayKey = dayjsKeyToday();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < leadingEmpty; i++) {
    cells.push({ key: `empty-start-${i}`, day: null, dateKey: null, isToday: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = dateKeyFromParts(year, monthIndex, day);
    cells.push({ key: dateKey, day, dateKey, isToday: dateKey === todayKey });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `empty-end-${cells.length}`, day: null, dateKey: null, isToday: false });
  }
  return cells;
}

function dayjsKeyToday() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date());
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const { year, monthIndex } = parseMonth(params.month);
  const range = bogotaMonthRange(year, monthIndex);
  const cells = buildMonthCells(year, monthIndex);

  const { coaches, calls } = await getAdminMonthCalendar(range);

  const previous = addMonths(year, monthIndex, -1);
  const next = addMonths(year, monthIndex, 1);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && monthIndex === now.getMonth();

  return (
    <div>
      <PageHeader
        title="Calendario"
        description="Todas las llamadas del mes, de todos los coaches a la vez."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/calendar?month=${monthParam(now.getFullYear(), now.getMonth())}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              isCurrentMonth ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-muted"
            }`}
          >
            Hoy
          </Link>
          <Link
            href={`/admin/calendar?month=${monthParam(previous.year, previous.monthIndex)}`}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-surface-muted"
          >
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link
            href={`/admin/calendar?month=${monthParam(next.year, next.monthIndex)}`}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-surface-muted"
          >
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <h2 className="ml-1 text-lg font-semibold text-foreground">{monthLabel(year, monthIndex)}</h2>
        </div>
        <p className="text-xs text-muted-2">{calls.length} llamadas este mes</p>
      </div>

      {coaches.length === 0 ? (
        <EmptyState title="No hay coaches activos" description="Activa o crea coaches para ver el calendario." />
      ) : (
        <GoogleStyleCalendar cells={cells} calls={calls} coaches={coaches} />
      )}
    </div>
  );
}
