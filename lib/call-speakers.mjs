// Quién habló de verdad en una llamada, leído de la transcripción de la página pública de compartir.
// Fathom nombra cada cuenta de coach con una etiqueta fija ("Ross a (Joinaceleratalent)", "Coach C …").
// Solo se guardan los nombres y la cantidad de intervenciones; nunca el contenido de la conversación.
export const SPEAKER_LABELS = {
  'maria@joinaceleratalent.com': /^maria lorena/i,
  'coach@joinaceleratalent.com': /^coach c\b/i,
  'ross@joinaceleratalent.com': /^ross a\b/i,
  'alex@joinaceleratalent.com': /^alex a\b/i,
  'jota@joinaceleratalent.com': /^jota a\b/i,
  'mari@joinaceleratalent.com': /^mari a\b/i,
};

/** Hablantes de la llamada: { "Nombre": { turns, chars } }, o null si no se pudo leer. */
export async function fetchCallSpeakers(shareUrl, { fetchImpl = fetch } = {}) {
  try {
    if (!/^https:\/\/fathom\.video\/share\//i.test(String(shareUrl ?? ''))) return null;
    const html = await (await fetchImpl(shareUrl, { signal: AbortSignal.timeout(30000) })).text();
    const link = html.match(/copyTranscriptUrl&quot;:&quot;([^&]+(?:&amp;[^&]+)*?)&quot;/);
    if (!link) return null;
    const data = await (await fetchImpl(link[1].replaceAll('&amp;', '&'), { signal: AbortSignal.timeout(30000) })).json();
    const speakers = {};
    for (const turn of data.html.matchAll(/<a[^>]*>@[\d:]+<\/a> - <b>([^<]+)<\/b><\/p><p[^>]*>([^<]*)<\/p>/g)) {
      const name = turn[1].trim();
      speakers[name] ??= { turns: 0, chars: 0 };
      speakers[name].turns += 1;
      speakers[name].chars += turn[2].length;
    }
    return speakers;
  } catch { return null; }
}

/** Emails de los coaches que hablaron (3 intervenciones o más). */
export function speakingCoachEmails(speakers, minTurns = 3) {
  return Object.entries(SPEAKER_LABELS)
    .filter(([, label]) => Object.entries(speakers ?? {}).some(([name, s]) => label.test(name) && s.turns >= minTurns))
    .map(([email]) => email);
}
