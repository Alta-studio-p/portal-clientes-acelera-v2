// Horas a pagar según lo que dura la llamada en Fathom.
// ≤40 min: media hora · hasta 80 min: 1 h · hasta 105 min: 1,5 h · hasta 135 min: 2 h.
// Más de 135 min: se redondea a la media hora más cercana.
export const SHORT_CALL_MINUTES = 15; // por debajo conviene revisar si la llamada fue efectiva

export function hoursForMinutes(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m <= 40) return 0.5;
  if (m <= 80) return 1;
  if (m <= 105) return 1.5;
  if (m <= 135) return 2;
  return Math.round(m / 30) / 2;
}
