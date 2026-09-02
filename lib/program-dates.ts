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

function daysUntil(dateStr: string): number {
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [year, month, day] = dateStr.split("-").map(Number);
  const targetUTC = Date.UTC(year, month - 1, day);
  return Math.round((targetUTC - todayUTC) / (1000 * 60 * 60 * 24));
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
