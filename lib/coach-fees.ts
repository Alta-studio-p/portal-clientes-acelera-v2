export interface FeeRow {
  id: string | null;
  call_id: string | null;
  coach_id: string;
  client_id: string | null;
  client_name: string;
  service_date: string;
  topic: string;
  hours: number | null;
  amount: number | null;
  payment_type: string | null;
  paid_on: string | null;
  recording_url: string | null;
}

export const CALL_HOURLY_RATE = 100_000;

export const PAYMENT_TYPES = [
  { value: 'transfer', label: 'Transferencia bancaria' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'other', label: 'Otro' },
] as const;

export function money(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export function feeDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
}

export function currentMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}

export function validMonth(value?: string) {
  return value && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(value) ? value : currentMonth();
}

export function monthBounds(month: string) {
  const [year, number] = month.split('-').map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10) };
}

export function safeRecordingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
