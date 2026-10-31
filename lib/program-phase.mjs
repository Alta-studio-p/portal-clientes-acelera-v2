// Estado del programa según la fecha de FIN (hoy se compara con la zona horaria de Bogotá):
//  · Activo: el fin es posterior a hoy. Si faltan 15 días o menos: etiqueta amarilla "Termina en X días".
//  · Recién finalizado: el fin es hoy o pasó hace 15 días o menos. Sigue en "Activos". Etiqueta naranja "Finalizó hace X días" / "Finalizó hoy".
//  · Finalizado: el fin pasó hace más de 15 días.
//  · Excepción: marcado Finalizado a mano antes de su fecha de fin (estado guardado 'inactive' con fin futuro) se respeta.
//  · Sin fecha de fin: se deja el estado guardado.
// Misma regla que la función client_program_status() de la base (supabase-program-status.sql).
export const RECENT_DAYS = 15;
const DAY_MS = 86_400_000;
const utc = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * @param {{ status: string | null, endDate: string | null }} client
 * @param {string} today AAAA-MM-DD
 * @returns {{ phase: 'activo' | 'recien' | 'finalizado', days: number | null, manual: boolean, tag: { text: string, tone: 'soon' | 'recent' } | null }}
 */
export function programPhase({ status, endDate }, today) {
  if (!endDate) return { phase: status === 'inactive' ? 'finalizado' : 'activo', days: null, manual: false, tag: null };
  const days = Math.round((utc(endDate) - utc(today)) / DAY_MS); // > 0: faltan · < 0: pasaron
  if (status === 'inactive' && days > 0) return { phase: 'finalizado', days, manual: true, tag: null };
  if (days > 0) return { phase: 'activo', days, manual: false, tag: days <= RECENT_DAYS ? { text: `Termina en ${plural(days, 'día', 'días')}`, tone: 'soon' } : null };
  if (-days <= RECENT_DAYS) return { phase: 'recien', days, manual: false, tag: { text: days === 0 ? 'Finalizó hoy' : `Finalizó hace ${plural(-days, 'día', 'días')}`, tone: 'recent' } };
  return { phase: 'finalizado', days, manual: false, tag: null };
}

/** Estado guardado que corresponde a la fase (activo y recién finalizado siguen como activos; la extensión se conserva). */
export const storedStatusFor = (status, phase) => (phase === 'finalizado' ? 'inactive' : status === 'extension' ? 'extension' : 'active');
