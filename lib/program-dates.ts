import type { ClientStatus } from "@/lib/supabase/types";

// Estado que representa a un cliente que ya terminó el programa. La alerta
// naranja de "por terminar" no aplica a estos clientes.
const FINISHED_STATUS: ClientStatus = "inactive";

// Fecha final por defecto: mismo día, 3 meses después. Ej: 2026-03-02 ->
// 2026-06-02. Es solo el valor inicial sugerido; end_date siempre queda
// editable para extensiones y nunca se recalcula sola.
export function addThreeMonthsSameDay(startDate: string): string {
  const [year, month, day] = startDate.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + 3, day));
  return result.toISOString().slice(0, 10);
}

const DAY_MS = 1000 * 60 * 60 * 24;

function parseUTCDate(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function todayUTC(): number {
  const today = new Date();
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

function daysUntil(dateStr: string): number {
  return Math.round((parseUTCDate(dateStr) - todayUTC()) / DAY_MS);
}

export interface ProgramAlert {
  daysRemaining: number;
  label: string;
}

// Alerta puramente visual: nunca se guarda en la base de datos ni cambia el
// estado del cliente, incluso si la fecha final ya pasó.
export function getProgramAlert(client: {
  status: ClientStatus | string | null;
  end_date: string | null;
}): ProgramAlert | null {
  if (!client.end_date) return null;
  if (client.status === FINISHED_STATUS) return null;

  const daysRemaining = daysUntil(client.end_date);
  if (daysRemaining > 15) return null;

  let label: string;
  if (daysRemaining < 0) label = "Fecha final superada";
  else if (daysRemaining === 0) label = "Finaliza hoy";
  else label = `Termina en ${daysRemaining} día${daysRemaining === 1 ? "" : "s"}`;

  return { daysRemaining, label };
}

export interface ProgramProgress {
  percentElapsed: number;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
}

// Progreso del programa como % de días transcurridos entre start_date y
// end_date. null si al cliente le faltan esas fechas (clientes legacy antes
// de supabase-add-program-dates.sql).
export function getProgramProgress(client: {
  start_date: string | null;
  end_date: string | null;
}): ProgramProgress | null {
  if (!client.start_date || !client.end_date) return null;

  const start = parseUTCDate(client.start_date);
  const end = parseUTCDate(client.end_date);
  const totalDays = Math.round((end - start) / DAY_MS);
  if (totalDays <= 0) return null;

  const daysElapsed = Math.min(totalDays, Math.max(0, Math.round((todayUTC() - start) / DAY_MS)));
  const percentElapsed = Math.round((daysElapsed / totalDays) * 100);
  const daysRemaining = totalDays - daysElapsed;

  return { percentElapsed, daysElapsed, daysRemaining, totalDays };
}

// Todos los programas de Acelera son de llamada semanal. "Atrasado" = pasaron
// más de WEEKLY_GRACE_DAYS desde la última llamada (o desde el inicio del
// programa si todavía no hubo ninguna), y el cliente sigue activo/extensión.
const WEEKLY_GRACE_DAYS = 9;

export interface CadenceStatus {
  behind: boolean;
  daysSinceLastCall: number | null;
}

export function getCadenceStatus(client: {
  status: ClientStatus | string | null;
  start_date: string | null;
  last_call_at: string | null;
}): CadenceStatus {
  if (client.status !== "active" && client.status !== "extension") {
    return { behind: false, daysSinceLastCall: null };
  }

  const referenceDate = client.last_call_at ? client.last_call_at.slice(0, 10) : client.start_date;
  if (!referenceDate) return { behind: false, daysSinceLastCall: null };

  const daysSinceLastCall = Math.round((todayUTC() - parseUTCDate(referenceDate)) / DAY_MS);
  return { behind: daysSinceLastCall > WEEKLY_GRACE_DAYS, daysSinceLastCall };
}
