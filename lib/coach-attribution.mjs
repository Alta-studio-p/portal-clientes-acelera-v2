// La llamada es del coach que la hizo (quien la grabó en Fathom), sin importar
// de qué coach sea el cliente: a ese coach se le suman horas y honorarios.
import { normalizeEmail } from './client-matching.mjs';

/**
 * @param {{ recordedByEmail?: string|null, organizerEmail?: string|null, coaches: { id: string, email?: string|null, alternate_emails?: string[]|null }[],
 *   keepCoachId?: string|null, assignedCoachId?: string|null, sourceCoachId?: string|null }} input
 * @returns {{ coachId: string|null, resolution: 'recorded_by'|'fallback', needsConfirmation: boolean }}
 */
export function resolveCallCoach({ recordedByEmail, organizerEmail, coaches, keepCoachId = null, assignedCoachId = null, sourceCoachId = null }) {
  for (const raw of [recordedByEmail, organizerEmail]) {
    const email = normalizeEmail(raw);
    if (!email) continue;
    const coach = coaches.find(c => [c.email, ...(c.alternate_emails ?? [])].some(e => normalizeEmail(e) === email));
    if (coach) return { coachId: coach.id, resolution: 'recorded_by', needsConfirmation: false };
  }
  // Sin dato fiable: se conserva el coach actual; para llamadas nuevas, el coach del cliente.
  return { coachId: keepCoachId ?? assignedCoachId ?? sourceCoachId ?? null, resolution: 'fallback', needsConfirmation: true };
}
