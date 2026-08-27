// Fathom no siempre captura el nombre real del participante (a veces guarda
// el email como "name"), así que clients.full_name termina siendo igual al
// email. Este script usa OpenRouter (gpt-4o-mini) para leer los títulos y
// resúmenes de las llamadas del cliente y extraer su nombre real, si aparece
// mencionado con confianza. Nunca inventa un nombre: si no está claro, deja
// el cliente sin tocar.
//
// Dry-run:  node scripts/enrich-client-names.mjs
// Apply:    node scripts/enrich-client-names.mjs --apply
//
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (o SUPABASE_SECRET_KEY), y OPENROUTER_API_KEY (o LLM_API_KEY).

import fs from "node:fs";

loadEnv(".env.local");

const APPLY = process.argv.includes("--apply");
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

async function fetchClientsWithoutRealName() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/clients`);
  url.searchParams.set("select", "id,email,full_name");
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  const clients = await res.json();
  const skip = new Set(
    (process.env.ENRICH_SKIP_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
  return clients.filter(
    (c) =>
      (!c.full_name || c.full_name.trim().toLowerCase() === c.email.trim().toLowerCase()) &&
      !skip.has(c.email.trim().toLowerCase())
  );
}

async function fetchCallSamples(clientId) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/calls`);
  url.searchParams.set("select", "title,summary");
  url.searchParams.set("client_id", `eq.${clientId}`);
  url.searchParams.set("order", "started_at.asc");
  url.searchParams.set("limit", "3");
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function extractName(client, calls) {
  const context = calls
    .map((c, i) => `Llamada ${i + 1} — título: "${c.title || "(sin título)"}"\nResumen: ${(c.summary || "").slice(0, 1200)}`)
    .join("\n\n");

  const prompt = `Estás viendo información de sesiones de coaching de carrera. El cliente tiene este email: ${client.email}

Tu tarea: identificar el NOMBRE COMPLETO real de esa persona (el cliente/coachee, no el coach de Acelera Talent), si aparece mencionado con claridad en los títulos o resúmenes de sus llamadas.

${context}

Reglas:
- Responde SOLO con el nombre completo (ej: "Carolina Henao"), sin explicación.
- Si no puedes identificar el nombre con confianza razonable, responde exactamente: DESCONOCIDO
- No confundas al cliente con el coach (los coaches se llaman Alex, Jota, Mari o Ross).
- No inventes apellidos que no aparezcan en el texto.`;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 20,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned empty content");
  return text.replace(/^["“]|["”]$/g, "").trim();
}

async function applyName(clientId, fullName) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ full_name: fullName }),
  });
  if (!res.ok) throw new Error(`Supabase update failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const clients = await fetchClientsWithoutRealName();
  console.log(`${clients.length} clientes sin nombre real (full_name vacío o igual al email).`);
  console.log(APPLY ? "Modo: APPLY (se escribirá en Supabase)" : "Modo: DRY-RUN (no se escribe nada)");
  console.log("");

  let found = 0;
  let unknown = 0;
  let failed = 0;

  for (const client of clients) {
    try {
      const calls = await fetchCallSamples(client.id);
      const name = await extractName(client, calls);

      if (name === "DESCONOCIDO" || !name) {
        console.log(`- ${client.email} → sin nombre claro, se deja igual`);
        unknown++;
      } else {
        console.log(`- ${client.email} → "${name}"`);
        if (APPLY) await applyName(client.id, name);
        found++;
      }
    } catch (err) {
      console.error(`  ! error en ${client.email}:`, err.message);
      failed++;
    }
    if (DELAY_MS) await sleep(DELAY_MS);
  }

  console.log("");
  console.log(`Listo. encontrados=${found} sin_identificar=${unknown} failed=${failed}`);
  if (!APPLY) {
    console.log("Este fue un dry-run. Vuelve a correr con --apply para guardar los nombres en Supabase.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
