export const SESSION_LIMIT = 12;
export function sessionProgress(count: number) {
  const sessions = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  return { sessions, percent: Math.min(100, Math.round(sessions / SESSION_LIMIT * 100)), excess: Math.max(0, sessions - SESSION_LIMIT), remaining: Math.max(0, SESSION_LIMIT - sessions) };
}
export function validProgressDate(value: string) {
  const date = new Date(value + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '2200-12-31' && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export interface ProgressClient {
  id: string; name: string; email: string; startDate: string | null; lastCall: string | null;
  calls: number; coaches: string[]; coachIds: string[]; categoryId: string | null;
}
export interface ProgressCategory { id: string; label: string; active: boolean }

export function formatProgressDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {year:'numeric',month:'short',day:'numeric',timeZone:/^\d{4}-\d{2}-\d{2}$/.test(value) ? 'UTC' : 'America/Bogota'}).format(date);
}
