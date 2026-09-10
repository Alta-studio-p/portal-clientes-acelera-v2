// Escala de severidad verde -> ámbar -> rojo para el % de avance de un
// cliente (verde = buen progreso, rojo = bajo progreso). Se interpola entre
// los mismos tokens de estado que ya usa el resto de la app (StatusBadge /
// ProgramAlertBadge), no colores nuevos.
const GREEN: [number, number, number] = [0x1f, 0x7a, 0x4c]; // --status-active
const AMBER: [number, number, number] = [0xd6, 0x85, 0x52]; // --alert-warning
const RED: [number, number, number] = [0xb3, 0x26, 0x1e]; // --danger

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

export function progressColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  if (p >= 50) {
    return toHex(mix(GREEN, AMBER, (100 - p) / 50));
  }
  return toHex(mix(AMBER, RED, (50 - p) / 50));
}

export function readableTextColor(bgHex: string): string {
  const n = parseInt(bgHex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#16181d" : "#ffffff";
}
