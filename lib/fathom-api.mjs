const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Fuentes de Fathom (una por coach) desde FATHOM_SOURCE_{COACH}_API_KEY. */
export function fathomSourcesFromEnv(env = process.env) {
  return Object.entries(env).flatMap(([key, value]) => {
    const match = key.match(/^FATHOM_SOURCE_(.+)_API_KEY$/);
    return match && value ? [{ key: match[1].toLowerCase(), apiKey: value }] : [];
  });
}

async function fathomGet(source, path, attempt = 0) {
  const response = await fetch(`https://api.fathom.ai/external/v1/${path}`, { headers: { 'X-Api-Key': source.apiKey }, signal: AbortSignal.timeout(60000) });
  if (response.status === 429) {
    if (attempt >= 4) throw new Error(`Fathom ${source.key}: límite de peticiones persistente.`);
    await wait(65_000);
    return fathomGet(source, path, attempt + 1);
  }
  if (!response.ok) throw new Error(`Fathom ${source.key} ${response.status}: ${await response.text()}`);
  return response.json();
}

/** Reuniones de una fuente sin resúmenes: solo lo necesario para links, quién grabó e invitados. */
export async function listMeetingsLight(source, maxPages = 200) {
  const meetings = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({ limit: '100' });
    if (cursor) params.set('cursor', cursor);
    const data = await fathomGet(source, `meetings?${params}`);
    const items = Array.isArray(data.items) ? data.items : [];
    meetings.push(...items);
    cursor = data.next_cursor;
    if (!cursor || !items.length) return meetings;
    await wait(1200);
  }
  throw new Error(`Fathom ${source.key}: historial truncado en ${maxPages} páginas.`);
}
