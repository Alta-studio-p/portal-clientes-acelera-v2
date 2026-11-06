export const masterclassStatuses = {
  draft: 'Borrador',
  scheduled: 'Programada',
  cancelled: 'Cancelada',
  recording: 'Grabación publicada',
};

const bogota = 'America/Bogota';
const dateTime = new Intl.DateTimeFormat('es-CO', {
  timeZone: bogota, dateStyle: 'long', timeStyle: 'short',
});
const dateOnly = new Intl.DateTimeFormat('es-CO', { timeZone: bogota, dateStyle: 'long' });

/** @param {string} date @param {boolean} [includeTime] */
export function formatMasterclassDate(date, includeTime = true) {
  return (includeTime ? dateTime : dateOnly).format(new Date(date));
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
  const local = read('starts_at');
  const minutes = read('duration_minutes');
  const duration = status === 'recording' && !minutes ? null : Number(minutes);
  if (!title || title.length > 160 || description.length > 2000) throw new Error('Revisa el título y la descripción.');
  if (!Object.hasOwn(masterclassStatuses, status)) throw new Error('Selecciona un estado válido.');
  if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Indica una fecha y hora válidas.');
  const date = new Date(`${local}:00-05:00`);
  if (masterclassLocalInput(date.toString()) !== local) throw new Error('Indica una fecha y hora válidas.');
  if (duration !== null && (!Number.isInteger(duration) || duration < 5 || duration > 480)) throw new Error('La duración debe ser de 5 a 480 minutos.');
  const live = masterclassLiveUrl(read('live_url'));
  const drive = masterclassDriveUrl(read('drive_url'));
  if ((read('live_url') || status === 'scheduled') && !live) throw new Error('Agrega un enlace válido de Google Meet o Zoom.');
  if ((read('drive_url') || status === 'recording') && !drive) throw new Error('Agrega el enlace de un video de Google Drive.');
  if (status === 'recording' && date.getTime() > now) throw new Error('No se puede publicar una grabación con fecha futura.');
  return { title, description, status, startsAt: date.toISOString(), duration, live, drive };
}
