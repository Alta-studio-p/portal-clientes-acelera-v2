import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const CHECK_ONLY = process.argv.includes("--check");
const TRANSLATE_ALL = process.argv.includes("--all") || process.env.TRANSLATE_ES_ALL === "1";
const LIMIT = Number(process.env.TRANSLATE_ES_LIMIT || process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 0);
const DELAY_MS = Number(process.env.TRANSLATE_ES_DELAY_MS || 800);
const CONCURRENCY = Number(process.env.TRANSLATE_ES_CONCURRENCY || 6);

loadEnv(".env.local");

const MODEL = process.env.OPENROUTER_MODEL || process.env.LLM_MODEL || "openai/gpt-4o-mini";
const BASE_URL = process.env.OPENROUTER_BASE_URL || process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const LLM_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !LLM_API_KEY) {
  console.error("Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y LLM_API_KEY.");
  process.exit(1);
}

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, "utf8").split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value || "").trim();
}

function hasEnglishSignals(value) {
  return /\b(meeting purpose|key takeaways|action items|next steps|client background|topics discussed|discussion topics|program structure|immediate interview prep|career focus|last role|role eliminated|the goal is|focused on|seeking a|will conduct|will actively|applications starting|standard applications)\b/i.test(
    cleanText(value)
  );
}

function needsTranslation(call) {
  return (
    hasEnglishSignals(call.summary) ||
    hasEnglishSignals(call.next_steps) ||
    hasEnglishSignals(call.display_title)
  );
}

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sb(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: sbHeaders(options.headers),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function fetchCalls() {
  const rows = await sb(
    "calls?select=id,client_id,title,display_title,started_at,summary,next_steps&or=(summary.not.is.null,next_steps.not.is.null)&order=started_at.asc.nullslast"
  );
  const candidates = TRANSLATE_ALL ? rows : rows.filter(needsTranslation);
  return LIMIT > 0 ? candidates.slice(0, LIMIT) : candidates;
}

async function translateCall(call) {
  const prompt = `Traduce al español latinoamericano el contenido de esta llamada de coaching de carrera.

Reglas:
- Devuelve SOLO JSON válido con las claves display_title, summary y next_steps.
- No inventes información, no agregues recomendaciones nuevas y no omitas datos.
- Conserva Markdown, bullets, negritas, enlaces y nombres propios.
- Traduce encabezados como "Meeting Purpose", "Key Takeaways" y "Action Items".
- Si un campo ya está en español, déjalo igual.
- Si un campo está vacío o null, devuelve null.
- El título debe ser breve, natural y en español.

Entrada:
${JSON.stringify(
  {
    display_title: call.display_title,
    title: call.title,
    summary: call.summary,
    next_steps: call.next_steps,
  },
  null,
  2
)}`;

  const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("El modelo no devolvió contenido.");
  return JSON.parse(content);
}

async function updateCall(call, translated) {
  const patch = {
    display_title: cleanText(translated.display_title) || call.display_title || null,
    summary: cleanText(translated.summary) || call.summary || null,
    next_steps: cleanText(translated.next_steps) || call.next_steps || null,
  };

  await sb(`calls?id=eq.${encodeURIComponent(call.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

async function refreshClientContexts() {
  const clients = await sb("clients?select=id");
  let updated = 0;

  for (const client of clients) {
    const calls = await sb(
      `calls?select=id,title,started_at,summary&client_id=eq.${encodeURIComponent(
        client.id
      )}&summary=not.is.null&order=started_at.asc.nullslast&limit=1`
    );
    const firstCall = calls[0];
    if (!firstCall?.summary) continue;

    const title = cleanText(firstCall.title) || "primera llamada";
    const date = firstCall.started_at ? String(firstCall.started_at).slice(0, 10) : "fecha no disponible";
    await sb(`clients?id=eq.${encodeURIComponent(client.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        first_call_id: firstCall.id,
        context_source_call_id: firstCall.id,
        context_generated_at: new Date().toISOString(),
        context_summary: `Contexto general creado desde la primera llamada registrada (${date}, ${title}).\n\n${firstCall.summary}`,
      }),
    });
    updated += 1;
  }

  return updated;
}

async function runPool(items, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const calls = await fetchCalls();
  console.log(
    TRANSLATE_ALL
      ? `${calls.length} llamadas serán revisadas/traducidas al español.`
      : `${calls.length} llamadas necesitan revisión/traducción al español.`
  );

  if (CHECK_ONLY) {
    for (const [index, call] of calls.entries()) {
      console.log(`${index + 1}/${calls.length} ${call.id}: ${call.display_title || call.title || "Sin título"}`);
    }
    return;
  }

  await runPool(calls, async (call, index) => {
    try {
      const translated = await translateCall(call);
      console.log(`${index + 1}/${calls.length} ${call.id}: ${translated.display_title || call.display_title || call.title}`);
      if (APPLY) await updateCall(call, translated);
      await wait(DELAY_MS);
    } catch (error) {
      console.error(`Error en ${call.id}:`, error.message);
    }
  });

  if (APPLY) {
    const contexts = await refreshClientContexts();
    console.log(`Contextos de cliente refrescados: ${contexts}`);
  } else {
    console.log("Modo prueba. Ejecuta con --apply para actualizar Supabase. Usa --all para revisar todas las llamadas.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
