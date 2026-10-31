// Vínculo llamada → cliente. Un solo módulo para el importador, el backfill
// y las acciones manuales. Orden: email principal, email alterno, nombre.
// Si hay más de un cliente posible (o ninguno) no se vincula: nunca se adivina.

export const INTERNAL_DOMAIN = 'joinaceleratalent.com';
// La propia cuenta de Fathom aparece como invitado en llamadas demo.
export const IGNORED_EMAIL_DOMAINS = ['fathom.video'];
// Correos de agenda/genéricos que Fathom mete como invitado junto al cliente
// real. Nunca identifican a un cliente.
export const IGNORED_EMAILS = [
  'mari.aceleratalent@gmail.com',
  'rlconsultalent@gmail.com',
  'rosa.aceleratalent@gmail.com',
  'alex.vega@cmglobalconsulting.com',
  'jonathan.aceleratalent@gmail.com',
];

export function normalizeIdentity(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(email) ? email : null;
}

export function isIgnoredEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return true;
  const domain = normalized.split('@')[1];
  return domain === INTERNAL_DOMAIN || IGNORED_EMAIL_DOMAINS.includes(domain) || IGNORED_EMAILS.includes(normalized);
}

/** Invitados que pueden identificar a un cliente: sin equipo interno ni correos de agenda. */
export function clientInvitees(invitees) {
  return (Array.isArray(invitees) ? invitees : [])
    .map(i => ({ email: normalizeEmail(i?.email), name: String(i?.name ?? '').trim() }))
    .filter(i => i.email && !isIgnoredEmail(i.email));
}

/** Pares de palabras que identifican a un cliente: nombre + primer apellido, nombre + último apellido. */
export function namePairs(fullName) {
  const tokens = normalizeIdentity(fullName).split(' ').filter(Boolean);
  if (tokens.length < 2) return [];
  return [[tokens[0], tokens[1]], [tokens[0], tokens[tokens.length - 1]]];
}

// El par debe aparecer completo en el texto; no hace falta que sea contiguo
// ("Carlos Alberto Herreño Vargas" encaja con el cliente "Carlos Herreño").
const hasPair = (text, [first, second]) => {
  const words = new Set(text.split(' '));
  return words.has(first) && words.has(second);
};

/**
 * @param {{ invitees?: {email?: string|null, name?: string|null}[], title?: string|null }} meeting
 * @param {{ id: string, email?: string|null, full_name?: string|null, alternate_emails?: string[]|null }[]} clients
 * @returns {{ client: object|null, method: 'email'|'alt_email'|'name'|null, reason: string, learnEmail: string|null }}
 */
export function matchClient(meeting, clients) {
  const candidates = clients.filter(c => !IGNORED_EMAILS.includes(normalizeEmail(c.email) ?? ''));
  const invitees = clientInvitees(meeting.invitees);
  const emails = new Set(invitees.map(i => i.email));
  const none = reason => ({ client: null, method: null, reason, learnEmail: null });

  const byEmail = candidates.filter(c => emails.has(normalizeEmail(c.email) ?? ''));
  if (byEmail.length === 1) return { client: byEmail[0], method: 'email', reason: 'email', learnEmail: null };
  if (byEmail.length > 1) return none('ambiguous_email');

  const byAlt = candidates.filter(c => (c.alternate_emails ?? []).some(e => emails.has(normalizeEmail(e) ?? '')));
  if (byAlt.length === 1) return { client: byAlt[0], method: 'alt_email', reason: 'alt_email', learnEmail: null };
  if (byAlt.length > 1) return none('ambiguous_alt_email');

  const texts = [...invitees.map(i => normalizeIdentity(i.name)), normalizeIdentity(meeting.title)].filter(Boolean);
  const byName = candidates.filter(c => namePairs(c.full_name).some(pair => texts.some(text => hasPair(text, pair))));
  if (byName.length === 1) {
    return { client: byName[0], method: 'name', reason: 'name', learnEmail: emailToLearn(invitees, candidates) };
  }
  if (byName.length > 1) return none('ambiguous_name');
  return none(invitees.length ? 'no_client_matches_invitees_or_title' : 'no_external_invitees');
}

/**
 * Email del invitado que conviene guardar como alterno: solo si es el único
 * invitado cuyo email todavía no pertenece a ningún cliente.
 */
export function emailToLearn(invitees, clients) {
  const known = new Set(clients.flatMap(c => [c.email, ...(c.alternate_emails ?? [])]).map(e => normalizeEmail(e)).filter(Boolean));
  const fresh = [...new Set(clientInvitees(invitees).map(i => i.email).filter(e => !known.has(e)))];
  return fresh.length === 1 ? fresh[0] : null;
}
