// Colores por severidad, interpolados sobre los mismos tokens de estado que
// ya usa el resto de la app (StatusBadge / ProgramAlertBadge), no colores
// nuevos.
const AMBER: [number, number, number] = [0xd6, 0x85, 0x52]; // --alert-warning
const RED: [number, number, number] = [0xb3, 0x26, 0x1e]; // --danger

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

// Severidad de "días sin llamada" para clientes ya marcados como atrasados
// (ver getCadenceStatus, umbral > 9 días). Ámbar apenas se pasa del umbral,
// rojo pleno a partir de ~6 semanas sin sesión.
const CADENCE_MIN_DAYS = 9;
const CADENCE_MAX_DAYS = 45;

export function cadenceSeverityColor(daysSinceLastCall: number): string {
  const t = Math.max(0, Math.min(1, (daysSinceLastCall - CADENCE_MIN_DAYS) / (CADENCE_MAX_DAYS - CADENCE_MIN_DAYS)));
  return toHex(mix(AMBER, RED, t));
}
