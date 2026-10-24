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
  calls: number; coaches: string[]; coachIds: string[]; categoryIds: string[]; operationalStatus: string;
}
export interface ProgressCategory { id: string; label: string; active: boolean }

export function progressEndDate(start: string | null): string | null {
  if (!start || !validProgressDate(start)) return null;
  const [year, month, day] = start.split('-').map(Number);
  const end = new Date(Date.UTC(year, month - 1 + 3, 1));
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end.toISOString().slice(0, 10);
}

const categoryColors = [
  'bg-emerald-100 text-emerald-900', 'bg-sky-100 text-sky-900',
  'bg-amber-100 text-amber-900', 'bg-rose-100 text-rose-900',
  'bg-violet-100 text-violet-900', 'bg-cyan-100 text-cyan-900',
  'bg-lime-100 text-lime-900', 'bg-fuchsia-100 text-fuchsia-900',
  'bg-orange-100 text-orange-900', 'bg-indigo-100 text-indigo-900',
];
export function progressCategoryColor(id: string, categories: ProgressCategory[]) {
  const index = categories.map(category => category.id).sort().indexOf(id);
  return categoryColors[Math.max(0, index) % categoryColors.length];
}

const dateOnlyFormatter = new Intl.DateTimeFormat('es-CO', {year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
const timestampFormatter = new Intl.DateTimeFormat('es-CO', {year:'numeric',month:'short',day:'numeric',timeZone:'America/Bogota'});
export function formatProgressDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return (/^\d{4}-\d{2}-\d{2}$/.test(value) ? dateOnlyFormatter : timestampFormatter).format(date);
}
