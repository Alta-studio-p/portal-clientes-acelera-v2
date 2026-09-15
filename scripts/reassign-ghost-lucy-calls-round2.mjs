// Segunda ronda: reasigna las 23 llamadas restantes de la cuenta fantasma
// (alex.vega@cmglobalconsulting.com) a 5 clientes que YA EXISTÍAN en la
// base de datos (verificado a mano por nombre antes de correr esto — no
// tenían email cargado, por eso el primer script no los emparejó por
// correo) y les carga el email que se identificó en call_participants.
//
// Dry-run por defecto. Usar --apply para escribir.

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

// email del participante (tal como aparece en call_participants) -> cliente real ya existente
const MANUAL_MATCHES = {
  "eospina@gmail.com": { id: "3a078d19-4444-42ba-8239-de9672f2d419", name: "Elkin Ospina" },
  "jose.sebastian.rosas@gmail.com": { id: "1525df4c-612b-4547-95c0-dc19316f5c6a", name: "Juan Sebastian Rosas" },
  "srosas@metecno.lat": { id: "1525df4c-612b-4547-95c0-dc19316f5c6a", name: "Juan Sebastian Rosas" },
  "guillermoplazas@yahoo.com": { id: "eb62c26a-7da2-4085-bde3-604978dfcd65", name: "Guillermo Plazas" },
  "davidgogoz@hotmail.com": { id: "dd4b5b48-b197-4e5f-a74a-1ed9659c41e7", name: "David Gomez" },
  "jpmarg1@hotmail.com": { id: "80806c00-9b37-493c-a158-11abb5a1a992", name: "Juan Pablo Marquez" },
};

// Email "canónico" a guardar en clients.email por cliente (uno solo, aunque
// Sebastian tenga dos correos en distintas llamadas).
const CANONICAL_EMAIL = {
  "3a078d19-4444-42ba-8239-de9672f2d419": "eospina@gmail.com",
  "1525df4c-612b-4547-95c0-dc19316f5c6a": "jose.sebastian.rosas@gmail.com",
  "eb62c26a-7da2-4085-bde3-604978dfcd65": "guillermoplazas@yahoo.com",
  "dd4b5b48-b197-4e5f-a74a-1ed9659c41e7": "davidgogoz@hotmail.com",
  "80806c00-9b37-493c-a158-11abb5a1a992": "jpmarg1@hotmail.com",
};

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

async function main() {
  const calls = await sb(
    `calls?select=id,title,display_title,started_at&client_id=eq.${GHOST_CLIENT_ID}&order=started_at.asc`
  );
  const callIds = calls.map((c) => c.id);
  const participants = await sb(
    `call_participants?select=call_id,email,role_hint&call_id=in.(${callIds.join(",")})`
  );
  const byCall = new Map();
  for (const p of participants) {
    if (!byCall.has(p.call_id)) byCall.set(p.call_id, []);
    byCall.get(p.call_id).push(p);
  }

  const rows = [];
  const unmatched = [];
  for (const call of calls) {
    const parts = byCall.get(call.id) ?? [];
    const clientPart = parts.find((p) => p.role_hint === "client" && MANUAL_MATCHES[p.email?.toLowerCase()]);
    if (!clientPart) {
      unmatched.push(call);
      continue;
    }
    const match = MANUAL_MATCHES[clientPart.email.toLowerCase()];
    rows.push({ call_id: call.id, started_at: call.started_at, title: call.display_title || call.title, ...match });
  }

  console.log(`Llamadas a reasignar en esta ronda: ${rows.length}`);
  console.log(`Sin match en esta ronda (deberían ser 0): ${unmatched.length}`);
  for (const r of rows) {
    console.log(`${r.started_at.slice(0, 10)}  ${r.title}  -> ${r.name}`);
  }
  for (const c of unmatched) {
    console.log(`SIN MATCH: ${c.id} ${c.display_title || c.title}`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — no se escribió nada. Corre con --apply para aplicar.");
    return;
  }

  console.log("\nAplicando reasignaciones...");
  for (const r of rows) {
    await sbPatch(`calls?id=eq.${r.call_id}`, { client_id: r.id });
    console.log(`OK  ${r.call_id} -> ${r.name}`);
  }

  console.log("\nCargando email canónico en los 5 clientes...");
  for (const [clientId, email] of Object.entries(CANONICAL_EMAIL)) {
    await sbPatch(`clients?id=eq.${clientId}`, { email });
    console.log(`OK  ${clientId} -> ${email}`);
  }

  console.log(`\nListo. ${rows.length} llamadas reasignadas, 5 clientes con email cargado.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
