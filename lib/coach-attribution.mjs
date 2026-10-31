// La llamada es del coach que la hizo, sin importar de qué coach sea el cliente:
// a ese coach se le suman horas y honorarios.
//  1. Quien la grabó en Fathom, si es un coach que cobra por llamada.
//  2. Si la grabó una cuenta que no cobra por llamada (la coach principal, Caro) y en la
//     transcripción habló exactamente un coach que sí cobra, es de ese coach. Estar invitado
//     no cuenta: solo quien habla.
//  3. Si ese mismo encuentro ya está grabado por el propio coach (`hasOwnRecording`),
//     la copia de la coach principal no se atribuye, para no pagar dos veces.
import { normalizeEmail } from './client-matching.mjs';

const emailsOf = coach => [coach.email, ...(coach.alternate_emails ?? [])].map(normalizeEmail).filter(Boolean);
const billsByCall = coach => coach.bills_by_call !== false;

/**
 * @param {{ recordedByEmail?: string|null, organizerEmail?: string|null, speakerEmails?: string[],
 *   coaches: { id: string, email?: string|null, alternate_emails?: string[]|null, bills_by_call?: boolean }[],
 *   hasOwnRecording?: boolean, keepCoachId?: string|null, assignedCoachId?: string|null, sourceCoachId?: string|null }} input
 * @returns {{ coachId: string|null, resolution: 'recorded_by'|'participant'|'fallback', needsConfirmation: boolean }}
 */
export function resolveCallCoach({ recordedByEmail, organizerEmail, speakerEmails = [], coaches, hasOwnRecording = false, keepCoachId = null, assignedCoachId = null, sourceCoachId = null }) {
  let recorder = null;
  for (const raw of [recordedByEmail, organizerEmail]) {
    const email = normalizeEmail(raw);
    recorder = email ? coaches.find(c => emailsOf(c).includes(email)) : null;
    if (recorder) break;
  }
  if (recorder && billsByCall(recorder)) return { coachId: recorder.id, resolution: 'recorded_by', needsConfirmation: false };
  if (recorder) {
    // Grabó la coach principal: es del coach que cobra por llamada y habló en la transcripción, si es uno solo.
    const present = new Set(speakerEmails.map(normalizeEmail));
    const attending = coaches.filter(c => billsByCall(c) && emailsOf(c).some(e => present.has(e)));
    if (attending.length === 1 && !hasOwnRecording) return { coachId: attending[0].id, resolution: 'participant', needsConfirmation: false };
    return { coachId: recorder.id, resolution: 'recorded_by', needsConfirmation: false };
  }
  // Sin dato fiable: se conserva el coach actual; para llamadas nuevas, el coach del cliente.
  return { coachId: keepCoachId ?? assignedCoachId ?? sourceCoachId ?? null, resolution: 'fallback', needsConfirmation: true };
}

/** Llave para detectar el mismo encuentro grabado en dos cuentas: día (Bogotá) + título. */
export function sessionKey(localDate, title) {
  const clean = String(title ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${localDate}|${clean}`;
}
