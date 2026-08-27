// Genera un título corto y claro para cada llamada a partir de su resumen,
// usando OpenRouter (modelo gpt-4o-mini). No toca calls.title (el título
// crudo de Fathom); escribe el resultado en calls.display_title.
//
// Dry-run:  node scripts/enrich-call-titles.mjs
// Apply:    node scripts/enrich-call-titles.mjs --apply
//
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (o SUPABASE_SECRET_KEY), y una API key de OpenRouter en OPENROUTER_API_KEY
// (o LLM_API_KEY, mismo nombre que usa el proyecto viejo).

import fs from "node:fs";

loadEnv(".env.local");

const APPLY = process.argv.includes("--apply");
const LIMIT = Number(process.env.ENRICH_LIMIT || 500);
const DELAY_MS = Number(process.env.ENRICH_DELAY_MS || 300);
const BASE_URL = process.env.OPENROUTER_BASE_URL || process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
const MODEL = process.env.OPENROUTER_MODEL || process.env.LLM_MODEL || "openai/gpt-4o-mini";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENROUTER_API_KEY) {
  console.error(
    "Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y OPENROUTER_API_KEY (o LLM_API_KEY)."
  );
  process.exit(1);
}

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, "utf8").split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCallsNeedingTitle() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/calls`);
  url.searchParams.set(
    "select",
    "id,title,summary,display_title"
  );
  url.searchParams.set("summary", "not.is.null");
  url.searchParams.set("display_title", "is.null");
  url.searchParams.set("limit", String(LIMIT));

  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function generateTitle(call) {
  const prompt = `Eres un asistente que le pone título corto y claro a sesiones de coaching de carrera, a partir de su resumen.

Reglas:
- Máximo 8 palabras.
- En español, sin comillas ni punto final.
- Debe describir el TEMA/motivo puntual de esta sesión (ej: "Optimización de perfil de LinkedIn", "Preparación de entrevista técnica", "Revisión de CV y elevator pitch").
- No repitas el nombre del cliente ni la palabra "coaching" o "sesión" salvo que sea necesario para claridad.
- No inventes información que no esté en el resumen.

Título actual de Fathom (puede ser genérico o útil, úsalo como pista si ya es bueno): ${call.title || "(sin título)"}

Resumen de la llamada:
"""
${(call.summary || "").slice(0, 4000)}
"""

Responde SOLO con el título, sin explicación adicional.`;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 40,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned empty content");
  return text.replace(/^["“]|["”]$/g, "").trim();
}

async function applyTitle(callId, title) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/calls?id=eq.${callId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      display_title: title,
      display_title_generated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Supabase update failed: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const calls = await fetchCallsNeedingTitle();
  console.log(`${calls.length} llamadas sin display_title (con resumen disponible).`);
  console.log(APPLY ? "Modo: APPLY (se escribirá en Supabase)" : "Modo: DRY-RUN (no se escribe nada)");
  console.log("");

  let ok = 0;
  let failed = 0;

  for (const call of calls) {
    try {
      const title = await generateTitle(call);
      console.log(`- [${call.id.slice(0, 8)}] "${call.title || "(sin título)"}" → "${title}"`);
      if (APPLY) {
        await applyTitle(call.id, title);
      }
      ok++;
    } catch (err) {
      console.error(`  ! error en ${call.id}:`, err.message);
      failed++;
    }
    if (DELAY_MS) await sleep(DELAY_MS);
  }

  console.log("");
  console.log(`Listo. ok=${ok} failed=${failed}`);
  if (!APPLY) {
    console.log("Este fue un dry-run. Vuelve a correr con --apply para guardar los títulos en Supabase.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
