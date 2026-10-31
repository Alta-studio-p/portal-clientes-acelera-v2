// Horas a pagar según lo que dura la llamada en Fathom.
// Hasta 35 min: media hora · hasta 80 min: 1 h · hasta 105 min: 1,5 h · más de eso: 2 h.
// 2 horas (COP $200.000) es el máximo que se paga por una llamada; no existe más allá de eso.
export const MAX_CALL_HOURS = 2;
export const SHORT_CALL_MINUTES = 15; // por debajo conviene revisar si la llamada fue efectiva

export function hoursForMinutes(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (m <= 35) return 0.5;
  if (m <= 80) return 1;
  if (m <= 105) return 1.5;
  return MAX_CALL_HOURS;
}
