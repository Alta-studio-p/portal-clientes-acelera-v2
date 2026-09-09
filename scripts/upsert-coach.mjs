import fs from "node:fs";

loadEnv(".env.local");

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  })
);

const email = String(args.email || process.env.COACH_EMAIL || "").trim().toLowerCase();
const fullName = String(args.name || process.env.COACH_NAME || "").trim();
const sourceKey = String(args.source || process.env.COACH_SOURCE_KEY || "").trim().toLowerCase();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan variables: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!email || !fullName || !sourceKey) {
  console.error("Uso: node scripts/upsert-coach.mjs --email=coach@joinaceleratalent.com --name=\"Nombre\" --source=nombre");
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

async function main() {
  const rows = await sb("coaches?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      email,
      full_name: fullName,
      fathom_source_key: sourceKey,
      is_active: true,
    }),
  });

  const coach = rows[0];
  console.log(`Coach listo: ${coach.full_name || coach.email} (${coach.email})`);
  console.log(`Source key: ${coach.fathom_source_key}`);
  console.log("");
  console.log("Agrega estas variables a .env.local y a Vercel:");
  console.log(`FATHOM_SOURCE_${sourceKey.toUpperCase()}_API_KEY=<llave_de_fathom>`);
  console.log(`BACKFILL_SOURCE_${sourceKey.toUpperCase()}_TODAY=0`);
  console.log(`BACKFILL_SOURCE_${sourceKey.toUpperCase()}_DAYS=3650`);
  console.log(`BACKFILL_SOURCE_${sourceKey.toUpperCase()}_FROM_DATE=`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
