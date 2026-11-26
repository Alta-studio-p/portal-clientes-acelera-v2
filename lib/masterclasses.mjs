export const masterclassStatuses = {
  draft: 'Borrador',
  scheduled: 'Programada',
  cancelled: 'Cancelada',
  recording: 'Grabación publicada',
};

/** Orden fijo de las pestañas. Los colores viven en app/globals.css (--cat-*). */
export const masterclassCategories = {
  ai: 'Inteligencia artificial',
  executive_lab: 'Executive Lab',
  guides: 'Guías',
};

/** @param {string | null | undefined} category @returns {keyof typeof masterclassCategories} */
export function masterclassCategory(category) {
  return category && Object.hasOwn(masterclassCategories, category)
    ? /** @type {keyof typeof masterclassCategories} */ (category)
    : 'ai';
}

const bogota = 'America/Bogota';
const dateTime = new Intl.DateTimeFormat('es-CO', {
  timeZone: bogota, dateStyle: 'long', timeStyle: 'short',
});
const dateOnly = new Intl.DateTimeFormat('es-CO', { timeZone: bogota, dateStyle: 'long' });
const shortDate = new Intl.DateTimeFormat('es-CO', { timeZone: bogota, day: 'numeric', month: 'short', year: 'numeric' });
const DAY = 86_400_000;

/** @param {string} date @param {boolean} [includeTime] */
export function formatMasterclassDate(date, includeTime = true) {
  return (includeTime ? dateTime : dateOnly).format(new Date(date));
}

/**
 * Fecha que se muestra: la de la clase en vivo, o la de publicación (guías sin fecha en vivo).
 * @param {{ starts_at: string | null, published_at?: string | null }} item
 */
export function masterclassDisplayDate(item) {
  return item.starts_at ?? item.published_at ?? null;
}

/**
 * Fecha para ordenar de más reciente a más antigua: publicación, o la de la clase si aún no se publicó.
 * @param {{ starts_at: string | null, published_at?: string | null }} item
 */
export function masterclassSortDate(item) {
  return item.published_at ?? item.starts_at ?? null;
}

/** "hoy", "ayer", "hace 3 días" o "23 oct 2026". @param {string} date @param {number} [now] */
export function formatMasterclassRelative(date, now = Date.now()) {
  const days = Math.floor((now - new Date(date).getTime()) / DAY);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days > 1 && days < 7) return `hace ${days} días`;
  return shortDate.format(new Date(date)).replace(/\./g, '').replace(/ de /g, ' ');
}

/** Publicada en los últimos 7 días. @param {string | null | undefined} publishedAt @param {number} [now] */
export function isNewMasterclass(publishedAt, now = Date.now()) {
  if (!publishedAt) return false;
  const age = now - new Date(publishedAt).getTime();
  return age >= 0 && age < 7 * DAY;
}

/** @param {string} value */
export function masterclassLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // Colombia has no daylight saving time for the supported scheduling years.
  return new Date(date.getTime() - 5 * 3600_000).toISOString().slice(0, 16);
}

/** @param {string} raw @param {(url: URL) => boolean} accepts */
function safeUrl(raw, accepts) {
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && accepts(url)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** @param {string} raw */
export function masterclassDriveUrl(raw) {
  return safeUrl(raw, (url) => url.hostname === 'drive.google.com' &&
    /^\/file\/d\/[A-Za-z0-9_-]+\/view\/?$/.test(url.pathname));
}

/** @param {string} raw */
export function masterclassFathomUrl(raw) {
  return safeUrl(raw, (url) => url.hostname === 'fathom.video' && /^\/share\/[A-Za-z0-9_-]+\/?$/.test(url.pathname));
}

/** Cualquier enlace https sin credenciales ni puerto (portadas y materiales). @param {string} raw */
export function masterclassHttpsUrl(raw) {
  return safeUrl(raw, () => true);
}

/**
 * Materiales: una línea por recurso, "Título | https://…" o solo la URL.
 * @param {string} raw
 * @returns {{ title: string, url: string }[]}
 */
export function parseMasterclassResources(raw) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 20) throw new Error('Agrega como máximo 20 materiales.');
  return lines.map((line) => {
    const split = line.lastIndexOf('|');
    const label = split >= 0 ? line.slice(0, split).trim() : '';
    const url = masterclassHttpsUrl(split >= 0 ? line.slice(split + 1).trim() : line);
    if (!url) throw new Error(`Revisa el enlace del material "${line.slice(0, 60)}". Debe empezar por https://`);
    if (label.length > 160) throw new Error('El nombre de cada material debe tener máximo 160 caracteres.');
    return { title: label || new URL(url).hostname, url };
  });
}

/** Lee `resources` de la base de datos descartando entradas mal formadas. @param {unknown} value */
export function masterclassResources(value) {
  if (!Array.isArray(value)) return /** @type {{ title: string, url: string }[]} */ ([]);
  return value.flatMap((item) => {
    const url = masterclassHttpsUrl(String(item?.url ?? ''));
    return url ? [{ title: String(item?.title ?? '') || new URL(url).hostname, url }] : [];
  });
}

/** @param {{ title: string, url: string }[]} resources */
export function formatMasterclassResources(resources) {
  return resources.map((item) => `${item.title} | ${item.url}`).join('\n');
}

/** @param {string} raw */
export function masterclassDrivePreview(raw) {
  const drive = masterclassDriveUrl(raw);
  if (!drive) return null;
  const url = new URL(drive);
  const preview = new URL(url.pathname.replace(/\/view\/?$/, '/preview'), url.origin);
  const resourceKey = url.searchParams.get('resourcekey');
  if (resourceKey) preview.searchParams.set('resourcekey', resourceKey);
  return preview.href;
}

/** @param {string} raw */
export function masterclassLiveUrl(raw) {
  return safeUrl(raw, (url) =>
    (url.hostname === 'meet.google.com' && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname)) ||
    ((url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us')) && /^\/(j|my|webinar\/register)\/[a-z0-9_-]+\/?$/i.test(url.pathname))
  );
}

/** @param {FormData} form @param {number} [now] */
export function parseMasterclass(form, now = Date.now()) {
  const read = (/** @type {string} */ name) => String(form.get(name) ?? '').trim();
  const title = read('title');
  const description = read('description');
  const status = read('status');
  const category = read('category');
  const local = read('starts_at');
  const minutes = read('duration_minutes');
  if (!title || title.length > 160 || description.length > 2000) throw new Error('Revisa el título y la descripción.');
  if (!Object.hasOwn(masterclassCategories, category)) throw new Error('Selecciona una categoría.');
  if (!Object.hasOwn(masterclassStatuses, status)) throw new Error('Selecciona un estado válido.');
  const guide = category === 'guides';
  if (guide && !['draft', 'recording'].includes(status)) throw new Error('Las guías solo pueden quedar en borrador o publicadas.');
  /** @type {string | null} */
  let startsAt = null;
  if (local || !guide) {
    if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Indica una fecha y hora válidas.');
    const date = new Date(`${local}:00-05:00`);
    if (masterclassLocalInput(date.toString()) !== local) throw new Error('Indica una fecha y hora válidas.');
    if (status === 'recording' && date.getTime() > now) throw new Error('No se puede publicar una grabación con fecha futura.');
    startsAt = date.toISOString();
  }
  const duration = (status === 'recording' || guide) && !minutes ? null : Number(minutes);
  if (duration !== null && (!Number.isInteger(duration) || duration < 5 || duration > 480)) throw new Error('La duración debe ser de 5 a 480 minutos.');
  const live = masterclassLiveUrl(read('live_url'));
  const drive = masterclassDriveUrl(read('drive_url'));
  const fathom = masterclassFathomUrl(read('fathom_url'));
  const cover = masterclassHttpsUrl(read('cover_url'));
  const resources = parseMasterclassResources(read('resources'));
  if ((read('live_url') || status === 'scheduled') && !live) throw new Error('Agrega un enlace válido de Google Meet o Zoom.');
  if (read('drive_url') && !drive) throw new Error('Agrega el enlace de un video de Google Drive.');
  if (read('fathom_url') && !fathom) throw new Error('Agrega un enlace de compartir válido de Fathom.');
  if (read('cover_url') && !cover) throw new Error('Agrega un enlace https válido para la portada.');
  if (status === 'recording' && !drive && !fathom && !(guide && resources.length)) {
    throw new Error(guide ? 'Agrega un video o al menos un material para publicar la guía.' : 'Agrega una grabación de Drive o Fathom.');
  }
  return { title, description, status, startsAt, duration, live, drive, fathom, category, cover, resources };
}
