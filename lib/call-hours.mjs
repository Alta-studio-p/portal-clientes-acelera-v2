// Unidades de pago, no duración real: hasta 47 min = $50.000; más = $100.000.
export const MAX_CALL_HOURS = 1;
export const CALL_RATE_START_DATE = '2026-11-01';
export const SHORT_CALL_MINUTES = 15; // por debajo conviene revisar si la llamada fue efectiva

export function hoursForMinutes(minutes, serviceDate = CALL_RATE_START_DATE) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (serviceDate < CALL_RATE_START_DATE) {
    const rounded = Math.round(m);
    if (rounded <= 35) return 0.5;
    if (rounded <= 80) return 1;
    if (rounded <= 105) return 1.5;
    return 2;
  }
  if (m <= 47) return 0.5;
  return MAX_CALL_HOURS;
}

export function feeDurationMinutes(row) {
  if (row.call_id) return row.duration_minutes;
  return row.hours === null ? null : row.hours * 60;
}
