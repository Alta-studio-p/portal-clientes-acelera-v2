// Generaliza reassign-ghost-lucy-calls.mjs: reasigna las llamadas de
// CUALQUIER cuenta fantasma (de las 5 documentadas en README/CLAUDE.md) a
// sus clientes reales, usando call_participants como fuente de verdad.
//
// Dry-run por defecto. Usar --apply para escribir.
//
// Uso:
//   node scripts/reassign-ghost-account-calls.mjs --ghost=<client_id> --ghost-email=<email>
//   node scripts/reassign-ghost-account-calls.mjs --ghost=<client_id> --ghost-email=<email> --apply

import { readFileSync } from "node:fs";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function argValue(flag) {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.slice(flag.length + 3) : null;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

const GHOST_CLIENT_ID = argValue("ghost");
const GHOST_EMAIL = argValue("ghost-email")?.toLowerCase();
const COACH_DOMAIN = "@joinaceleratalent.com";

if (!GHOST_CLIENT_ID || !GHOST_EMAIL) {
  console.error("Uso: node scripts/reassign-ghost-account-calls.mjs --ghost=<client_id> --ghost-email=<email> [--apply]");
  process.exit(1);
}

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} -> ${res.status} ${await res.text()}`);
}

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .sort()
    .join(" ");
}

async function main() {
  const calls = await sb(
    `calls?select=id,title,display_title,started_at&client_id=eq.${GHOST_CLIENT_ID}&order=started_at.asc`
  );
  if (calls.length === 0) {
    console.log("Esta cuenta ya no tiene llamadas.");
    return;
  }
  const callIds = calls.map((c) => c.id);

  const participants = await sb(`call_participants?select=call_id,email,name,role_hint&call_id=in.(${callIds.join(",")})`);
  const byCall = new Map();
  for (const p of participants) {
    if (!byCall.has(p.call_id)) byCall.set(p.call_id, []);
    byCall.get(p.call_id).push(p);
  }

  const clientsAllStatus = await sb(`clients?select=id,full_name,email`);
  const byEmail = new Map(clientsAllStatus.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]));
  const byNameKey = new Map();
  for (const c of clientsAllStatus) {
    const key = normalize(c.full_name);
    if (key) byNameKey.set(key, c);
  }

  const rows = [];
  for (const call of calls) {
    const parts = (byCall.get(call.id) ?? []).filter(
      (p) => p.email?.toLowerCase() !== GHOST_EMAIL && !p.email?.toLowerCase().endsWith(COACH_DOMAIN)
    );
    const clientPart = parts.find((p) => p.role_hint === "client") ?? parts[0] ?? null;

    let match = null;
    if (clientPart?.email) match = byEmail.get(clientPart.email.toLowerCase()) ?? null;
    if (!match && clientPart?.name) match = byNameKey.get(normalize(clientPart.name)) ?? null;

    rows.push({
      call_id: call.id,
      started_at: call.started_at,
      title: call.display_title || call.title,
      participant_name: clientPart?.name ?? null,
      participant_email: clientPart?.email ?? null,
      all_participants: parts.map((p) => `${p.name || p.email}${p.role_hint ? `(${p.role_hint})` : ""}`).join(", "),
      match_client_id: match?.id ?? null,
      match_client_name: match?.full_name ?? null,
    });
  }

  const matched = rows.filter((r) => r.match_client_id && r.match_client_id !== GHOST_CLIENT_ID);
  const unmatched = rows.filter((r) => !r.match_client_id || r.match_client_id === GHOST_CLIENT_ID);

  console.log(`\nCuenta fantasma: ${GHOST_CLIENT_ID} (${GHOST_EMAIL})`);
  console.log(`Total llamadas: ${rows.length}`);
  console.log(`Con cliente real identificado: ${matched.length}`);
  console.log(`SIN match (necesitan revisión manual): ${unmatched.length}\n`);

  console.log("=== EMPAREJADAS (se reasignarían) ===");
  for (const r of matched) {
    console.log(
      `${r.started_at.slice(0, 10)}  ${r.title}\n  -> ${r.match_client_name} (${r.match_client_id})  [participante: ${r.participant_name || r.participant_email}]\n`
    );
  }

  console.log("=== SIN EMPAREJAR ===");
  for (const r of unmatched) {
    console.log(`${r.started_at.slice(0, 10)}  ${r.title}\n  participantes: ${r.all_participants || "(ninguno registrado)"}\n`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — no se escribió nada. Corre con --apply para aplicar las reasignaciones EMPAREJADAS.");
    return;
  }

  console.log("\nAplicando reasignaciones...");
  for (const r of matched) {
    await sbPatch(`calls?id=eq.${r.call_id}`, { client_id: r.match_client_id });
    console.log(`OK  ${r.call_id} -> ${r.match_client_name}`);
  }
  console.log(`\nListo. ${matched.length} llamadas reasignadas. ${unmatched.length} siguen en la cuenta fantasma.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
