// Lee los resúmenes de las llamadas de cada cliente y usa OpenRouter
// (gpt-4o-mini) para extraer el rango/expectativa salarial que busca, si se
// menciona con claridad. Nunca inventa una cifra: si no aparece, deja
// clients.desired_salary_range sin tocar.
//
// Dry-run:  node scripts/enrich-salary-range.mjs
// Apply:    node scripts/enrich-salary-range.mjs --apply
//
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (o SUPABASE_SECRET_KEY), y OPENROUTER_API_KEY (o LLM_API_KEY).
// Requiere haber corrido supabase-add-salary-range.sql primero.

import fs from "node:fs";

loadEnv(".env.local");

const APPLY = process.argv.includes("--apply");
const DELAY_MS = Number(process.env.ENRICH_DELAY_MS || 300);
const CALLS_PER_CLIENT = Number(process.env.ENRICH_CALLS_PER_CLIENT || 6);
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

async function fetchClients() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/clients`);
  url.searchParams.set("select", "id,email,full_name,desired_salary_range");
  const skip = new Set(
    (process.env.ENRICH_SKIP_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && body.includes("desired_salary_range")) {
      console.error(
        "La columna clients.desired_salary_range no existe todavía. Corre supabase-add-salary-range.sql primero."
      );
      process.exit(1);
    }
    throw new Error(`Supabase select failed: ${res.status} ${body}`);
  }
  const clients = await res.json();
  return clients.filter((c) => !c.desired_salary_range && !skip.has(c.email.trim().toLowerCase()));
}

async function fetchCallSummaries(clientId) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/calls`);
  url.searchParams.set("select", "title,summary");
  url.searchParams.set("client_id", `eq.${clientId}`);
  url.searchParams.set("summary", "not.is.null");
  url.searchParams.set("order", "started_at.asc");
  url.searchParams.set("limit", String(CALLS_PER_CLIENT));
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function extractSalaryRange(client, calls) {
  const context = calls
    .map((c, i) => `Llamada ${i + 1} — "${c.title || "(sin título)"}"\n${(c.summary || "").slice(0, 1800)}`)
    .join("\n\n");

  const prompt = `Estás viendo resúmenes de sesiones de coaching de carrera del cliente ${client.full_name || client.email}.

Tu tarea: identificar el rango o expectativa SALARIAL que el cliente busca en su nueva posición, si se menciona con claridad en algún momento.

${context}

Reglas:
- Responde SOLO con el rango/cifra tal como se menciona, de forma corta (ej: "15-17M COP", "USD 90k-110k", "12M COP mínimo").
- Incluye la moneda si se menciona.
- Si hay varias cifras mencionadas en distintos momentos, usa la más reciente o la que suene más definitiva (objetivo final, no piso mínimo de una etapa anterior).
- Si no se menciona ninguna cifra o rango salarial en todo el texto, responde exactamente: DESCONOCIDO
- No inventes ni redondees cifras que no aparezcan explícitamente.`;

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
      max_tokens: 30,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned empty content");
  return text.replace(/^["“]|["”]$/g, "").trim();
}

async function applySalaryRange(clientId, range) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      desired_salary_range: range,
      desired_salary_range_generated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Supabase update failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const clients = await fetchClients();
  console.log(`${clients.length} clientes sin desired_salary_range.`);
  console.log(APPLY ? "Modo: APPLY (se escribirá en Supabase)" : "Modo: DRY-RUN (no se escribe nada)");
  console.log("");

  let found = 0;
  let unknown = 0;
  let failed = 0;

  for (const client of clients) {
    try {
      const calls = await fetchCallSummaries(client.id);
      if (calls.length === 0) {
        console.log(`- ${client.email} → sin llamadas con resumen, se omite`);
        unknown++;
        continue;
      }

      const range = await extractSalaryRange(client, calls);

      if (range === "DESCONOCIDO" || !range) {
        console.log(`- ${client.email} → no se menciona rango salarial`);
        unknown++;
      } else {
        console.log(`- ${client.email} → "${range}"`);
        if (APPLY) await applySalaryRange(client.id, range);
        found++;
      }
    } catch (err) {
      console.error(`  ! error en ${client.email}:`, err.message);
      failed++;
    }
    if (DELAY_MS) await sleep(DELAY_MS);
  }

  console.log("");
  console.log(`Listo. encontrados=${found} sin_mencion=${unknown} failed=${failed}`);
  if (!APPLY) {
    console.log("Este fue un dry-run. Vuelve a correr con --apply para guardar en Supabase.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
