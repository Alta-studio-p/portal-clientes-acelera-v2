// Unidades de pago, no duración real: hasta 47 min = $50.000; más = $100.000.
export const MAX_CALL_HOURS = 1;
export const SHORT_CALL_MINUTES = 15; // por debajo conviene revisar si la llamada fue efectiva

export function hoursForMinutes(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m <= 47) return 0.5;
  return MAX_CALL_HOURS;
}
