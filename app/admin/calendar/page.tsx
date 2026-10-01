import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GoogleWeekCalendar, type WeekDay } from "@/components/google-week-calendar";
import { EmptyState, PageHeader } from "@/components/ui";
import { getAdminMonthCalendar } from "@/lib/data/admin";

const TIME_ZONE = "America/Bogota";
const DAY_MS = 86_400_000;

function todayBogotaKey() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE }).format(
    new Date()
  );
}

// Lunes de la semana que contiene `dateKey` (o la semana actual si no se da).
function mondayOf(dateKey?: string): Date {
  const key = dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : todayBogotaKey();
  const [y, m, d] = key.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = base.getUTCDay(); // 0=Dom..6=Sáb
  const diff = dow === 0 ? -6 : 1 - dow;
  base.setUTCDate(base.getUTCDate() + diff);
  return base;
}

function dateKeyFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

// Rango [from, to) en UTC que cubre el día Bogota de `monday` hasta 7 días después.
function weekRange(monday: Date) {
  const from = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 5));
  return { from: from.toISOString(), to: new Date(from.getTime() + 7 * DAY_MS).toISOString() };
}

function weekLabel(monday: Date) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
  const fmtDay = (d: Date, withMonth: boolean) =>
    new Intl.DateTimeFormat("es-MX", { day: "numeric", month: withMonth ? "short" : undefined, timeZone: "UTC" }).format(d);
  const year = sunday.getUTCFullYear();
  const start = fmtDay(monday, !sameMonth);
  const end = fmtDay(sunday, true);
  return `${start} – ${end}, ${year}`.replace(/\b\w/g, (c, i) => (i === 0 ? c.toUpperCase() : c));
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const monday = mondayOf(params.week);
  const range = weekRange(monday);
  const todayKey = todayBogotaKey();

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const dateKey = dateKeyFromDate(d);
    return { dateKey, dayNum: d.getUTCDate(), isToday: dateKey === todayKey };
  });

  const { coaches, calls } = await getAdminMonthCalendar(range);

  const previousMonday = addDays(monday, -7);
  const nextMonday = addDays(monday, 7);
  const currentWeekMonday = mondayOf(todayKey);
  const isCurrentWeek = dateKeyFromDate(monday) === dateKeyFromDate(currentWeekMonday);

  return (
    <div>
      <PageHeader title="Calendario" description="La semana de todos los coaches, hora por hora." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/calendar?week=${dateKeyFromDate(currentWeekMonday)}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              isCurrentWeek ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-muted"
            }`}
          >
            Hoy
          </Link>
          <Link
            href={`/admin/calendar?week=${dateKeyFromDate(previousMonday)}`}
            aria-label="Semana anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-surface-muted"
          >
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link
            href={`/admin/calendar?week=${dateKeyFromDate(nextMonday)}`}
            aria-label="Semana siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-surface-muted"
          >
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <h2 className="ml-1 text-lg font-semibold text-foreground">{weekLabel(monday)}</h2>
        </div>
        <p className="text-xs text-muted-2">{calls.length} llamadas esta semana</p>
      </div>

      {coaches.length === 0 ? (
        <EmptyState title="No hay coaches activos" description="Activa o crea coaches para ver el calendario." />
      ) : (
        <GoogleWeekCalendar days={days} calls={calls} coaches={coaches} />
      )}
    </div>
  );
}
