// Reasigna las 44 llamadas mal atribuidas a la cuenta fantasma
// alex.vega@cmglobalconsulting.com (importada por error como cliente,
// luego renombrada "Lucy Chacón" por enrich-client-names.mjs) a sus
// clientes reales, usando call_participants (role_hint = 'client') como
// fuente de verdad de quién participó en cada llamada.
//
// Dry-run por defecto. Usar --apply para escribir.
//
// Uso:
//   node scripts/reassign-ghost-lucy-calls.mjs
//   node scripts/reassign-ghost-lucy-calls.mjs --apply

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

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

const GHOST_CLIENT_ID = "a9be765c-2218-4b6b-a2c7-3041e1b8ce8d";
const GHOST_EMAIL = "alex.vega@cmglobalconsulting.com";
// Correos de coaches / equipo interno a ignorar como "posible dueño real".
const COACH_DOMAIN = "@joinaceleratalent.com";

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
  const callIds = calls.map((c) => c.id);

  const participants = await sb(
    `call_participants?select=call_id,email,name,role_hint&call_id=in.(${callIds.join(",")})`
  );
  const byCall = new Map();
  for (const p of participants) {
    if (!byCall.has(p.call_id)) byCall.set(p.call_id, []);
    byCall.get(p.call_id).push(p);
  }

  const clients = await sb(`clients?select=id,full_name,email&status=neq.inactive`);
  const clientsAllStatus = await sb(`clients?select=id,full_name,email`);
  const byEmail = new Map(
    clientsAllStatus.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c])
  );
  const byNameKey = new Map();
  for (const c of clientsAllStatus) {
    const key = normalize(c.full_name);
    if (key) byNameKey.set(key, c);
  }
  void clients;

  const rows = [];
  for (const call of calls) {
    const parts = (byCall.get(call.id) ?? []).filter(
      (p) => p.email?.toLowerCase() !== GHOST_EMAIL && !p.email?.toLowerCase().endsWith(COACH_DOMAIN)
    );
    // Preferir el participante marcado explícitamente como "client".
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

  const matched = rows.filter((r) => r.match_client_id);
  const unmatched = rows.filter((r) => !r.match_client_id);

  console.log(`\nTotal llamadas de la cuenta fantasma: ${rows.length}`);
  console.log(`Con cliente real identificado: ${matched.length}`);
  console.log(`SIN match (necesitan revisión manual): ${unmatched.length}\n`);

  console.log("=== EMPAREJADAS (se reasignarían) ===");
  for (const r of matched) {
    console.log(
      `${r.started_at.slice(0, 10)}  ${r.title}\n  -> ${r.match_client_name} (${r.match_client_id})  [participante: ${r.participant_name || r.participant_email}]\n`
    );
  }

  console.log("=== SIN EMPAREJAR (quedan en la cuenta fantasma, revisar a mano) ===");
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
