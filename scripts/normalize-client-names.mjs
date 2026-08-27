// Normaliza el formato de clients.full_name: quita mayúsculas sostenidas,
// reordena "Apellido, Nombre" → "Nombre Apellido", quita tags entre llaves
// ({PEP}) y deja Título Case consistente. No usa LLM, es determinístico.
//
// Dry-run:  node scripts/normalize-client-names.mjs
// Apply:    node scripts/normalize-client-names.mjs --apply

import fs from "node:fs";

loadEnv(".env.local");

const APPLY = process.argv.includes("--apply");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
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

function titleCaseWord(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeName(raw) {
  if (!raw) return raw;

  let name = raw
    .replace(/\{[^}]*\}/g, "") // quita tags como {PEP}
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // "Apellido, Nombre" -> "Nombre Apellido"
  if (name.includes(",")) {
    const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      name = `${parts[1]} ${parts[0]}`;
    }
  }

  name = name
    .split(" ")
    .filter(Boolean)
    .map(titleCaseWord)
    .join(" ");

  return name;
}

async function main() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/clients`);
  url.searchParams.set("select", "id,email,full_name");
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase select failed: ${res.status} ${await res.text()}`);
  const clients = await res.json();

  console.log(APPLY ? "Modo: APPLY (se escribirá en Supabase)" : "Modo: DRY-RUN (no se escribe nada)");
  console.log("");

  let changed = 0;

  for (const client of clients) {
    if (!client.full_name || client.full_name === client.email) continue; // ya cubierto por enrich:client-names

    const normalized = normalizeName(client.full_name);
    if (normalized === client.full_name) continue;

    console.log(`- "${client.full_name}" → "${normalized}"`);
    changed++;

    if (APPLY) {
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ full_name: normalized }),
      });
      if (!patchRes.ok) {
        console.error(`  ! error actualizando ${client.email}:`, await patchRes.text());
      }
    }
  }

  console.log("");
  console.log(`Listo. ${changed} nombres ${APPLY ? "actualizados" : "por actualizar"}.`);
  if (!APPLY) console.log("Vuelve a correr con --apply para guardar los cambios.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
