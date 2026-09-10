import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarCheck, Clock, PhoneCall, TriangleAlert } from "lucide-react";
import type { ClientListRow } from "@/lib/data/admin";
import { StatusBadge } from "@/components/status-badge";
import { getCadenceStatus, getProgramProgress } from "@/lib/program-dates";
import { formatDate, initials } from "@/lib/format";

// Posición (0-100) de una fecha dentro del rango [start, end] del programa,
// para ubicar cada llamada real sobre la barra de progreso.
function positionInRange(dateStr: string, startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  const total = end - start;
  if (total <= 0) return 0;

  const date = new Date(dateStr);
  const point = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.min(100, Math.max(0, ((point - start) / total) * 100));
}

// Colores fijos por valor (no clases Tailwind con variable + opacidad, ej.
// `border-[--alert-warning]/40`) — ese modificador de opacidad sobre una
// variable en formato hex no genera CSS válido en este proyecto y el borde
// terminaba sin color. Con estilo inline no depende de cómo Tailwind
// resuelva la variable.
const ACCENT = "#4c7c7e";
const ALERT_WARNING = "#d68552";

function Chip({ icon: Icon, children }: { icon: typeof PhoneCall; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
      <Icon size={13} strokeWidth={2} className="text-muted-2" aria-hidden="true" />
      {children}
    </span>
  );
}

export function ClientProgressRow({ client, href }: { client: ClientListRow; href: string }) {
  const progress = getProgramProgress(client);
  const cadence = getCadenceStatus({
    status: client.status,
    start_date: client.start_date,
    last_call_at: client.last_call_at,
  });
  // La barra de progreso siempre va en verde-azulado de marca — el naranja
  // queda reservado para la alerta de "sin llamada" (badge + borde), no para
  // el progreso en sí.
  const barColor = ACCENT;

  const callMarks = progress
    ? client.calls
        .filter((c) => c.started_at)
        .map((c) => positionInRange(c.started_at as string, client.start_date as string, client.end_date as string))
    : [];

  return (
    <Link
      href={href}
      className="block rounded-xl border bg-surface p-4 transition hover:border-accent/60 hover:shadow-[0_8px_24px_-16px_rgba(15,23,42,0.4)]"
      style={cadence.behind ? { borderColor: `${ALERT_WARNING}66` } : undefined}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
          {initials(client.full_name, client.email)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {client.full_name || client.email}
              </p>
              <p className="truncate text-xs text-muted-2">
                {client.coach_names.length > 0 ? client.coach_names.join(", ") : "Sin coach asignado"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {cadence.behind && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: `${ALERT_WARNING}22`, color: ALERT_WARNING }}
                >
                  <TriangleAlert size={12} strokeWidth={2.5} aria-hidden="true" />
                  Sin llamada hace {cadence.daysSinceLastCall} días
                </span>
              )}
              <StatusBadge status={client.status} />
            </div>
          </div>

          {progress ? (
            <>
              <div className="mt-3.5 flex items-center gap-3">
                <div className="relative h-2.5 flex-1 rounded-full bg-[--border]">
                  <div
                    className="h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.max(progress.percentElapsed, 3)}%`, backgroundColor: barColor }}
                  />
                  {callMarks.map((pos, i) => (
                    <span
                      key={i}
                      title={`Sesión ${i + 1}`}
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-foreground"
                      style={{ left: `${pos}%` }}
                    />
                  ))}
                </div>
                <span
                  className="w-12 shrink-0 text-right text-lg font-bold tabular-nums"
                  style={{ color: barColor }}
                >
                  {progress.percentElapsed}%
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Chip icon={PhoneCall}>
                  {client.call_count} sesion{client.call_count === 1 ? "" : "es"}
                </Chip>
                <Chip icon={CalendarCheck}>última: {formatDate(client.last_call_at)}</Chip>
                <Chip icon={Clock}>
                  {progress.daysRemaining >= 0
                    ? `faltan ${progress.daysRemaining} día${progress.daysRemaining === 1 ? "" : "s"}`
                    : "fecha final superada"}
                </Chip>
              </div>
            </>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Chip icon={PhoneCall}>
                {client.call_count} sesion{client.call_count === 1 ? "" : "es"}
              </Chip>
              <Chip icon={CalendarCheck}>última: {formatDate(client.last_call_at)}</Chip>
              <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs text-muted-2">
                Sin fechas de programa configuradas
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
