// Asigna coach a los clientes nuevos (creados sin coach en
// update-client-program-dates.mjs) y corrige 2 asignaciones según lo
// confirmado por el usuario. No toca clientes cuya asignación actual ya
// coincidía con lo pedido (la mayoría de la lista de Ross, y Sergio
// Cobos/Andrés Torres/Álvaro Bustos con Mari, ya estaban correctos).
//
// Dry-run:  node scripts/assign-coaches.mjs
// Apply:    node scripts/assign-coaches.mjs --apply

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
  for (const line of fs.readFileSync(path, "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function fetchClients() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=id,full_name,email,status`, { headers });
  if (!res.ok) throw new Error(`fetchClients failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchCoaches() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/coaches?select=id,full_name`, { headers });
  if (!res.ok) throw new Error(`fetchCoaches failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchAssignments() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/coach_client_assignments?select=id,client_id,coach_id`, { headers });
  if (!res.ok) throw new Error(`fetchAssignments failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createClient(full_name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify([{ full_name, status: "active" }]),
  });
  if (!res.ok) throw new Error(`createClient(${full_name}) failed: ${res.status} ${await res.text()}`);
  return (await res.json())[0];
}

async function insertAssignment(client_id, coach_id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/coach_client_assignments`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify([{ client_id, coach_id, is_primary: true }]),
  });
  if (!res.ok) throw new Error(`insertAssignment(${client_id},${coach_id}) failed: ${res.status} ${await res.text()}`);
  return (await res.json())[0];
}

async function deleteAssignment(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/coach_client_assignments?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`deleteAssignment(${id}) failed: ${res.status} ${await res.text()}`);
}

// target client name -> coach full_name (para los que necesitan asignación nueva)
const NEW_ASSIGNMENTS = [
  ["Guillermo Plazas", "Alex"],
  ["Juan Sebastian Rosas", "Alex"],
  ["Elkin Ospina", "Alex"],
  ["Omar Arenas", "Lorena"],
  ["Nestor Serrano", "Lorena"],
  ["Juan Felipe Muñoz", "Lorena"],
  ["Julian Ramirez", "Lorena"],
];

// clientes que hay que crear desde cero (sin correo) + su coach
const NEW_CLIENTS = [
  ["David Gomez", "Alex"],
  ["Johan Rodríguez", "Mari"],
];

// reasignaciones confirmadas por el usuario: email del cliente -> coach nuevo
const REASSIGN = [
  ["lucychacon75@gmail.com", "Alex", "Ross"],
  ["luisjaviergarzon93@gmail.com", "Alex", "Mari"],
];

async function main() {
  const [clients, coaches, assignments] = await Promise.all([
    fetchClients(),
    fetchCoaches(),
    fetchAssignments(),
  ]);

  const coachByName = new Map(coaches.map((c) => [normalizeName(c.full_name), c]));
  const clientByName = new Map(clients.map((c) => [normalizeName(c.full_name), c]));
  const clientByEmail = new Map(clients.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]));
  const assignmentsByClient = new Map();
  for (const a of assignments) {
    if (!assignmentsByClient.has(a.client_id)) assignmentsByClient.set(a.client_id, []);
    assignmentsByClient.get(a.client_id).push(a);
  }

  console.log(APPLY ? "=== APLICANDO ===" : "=== DRY RUN (usa --apply para ejecutar) ===\n");

  console.log("--- Asignaciones nuevas (clientes sin coach) ---");
  for (const [clientName, coachName] of NEW_ASSIGNMENTS) {
    const client = clientByName.get(normalizeName(clientName));
    const coach = coachByName.get(normalizeName(coachName));
    if (!client) { console.log(`! ${clientName}: cliente no encontrado`); continue; }
    const already = (assignmentsByClient.get(client.id) || []).some((a) => a.coach_id === coach.id);
    if (already) { console.log(`${clientName} -> ${coachName}: ya asignado, se omite`); continue; }
    console.log(`${clientName} -> ${coachName}`);
    if (APPLY) await insertAssignment(client.id, coach.id);
  }

  console.log("\n--- Clientes nuevos a crear ---");
  for (const [fullName, coachName] of NEW_CLIENTS) {
    const existing = clientByName.get(normalizeName(fullName));
    if (existing) { console.log(`${fullName}: ya existe, se omite creación`); continue; }
    const coach = coachByName.get(normalizeName(coachName));
    console.log(`crear "${fullName}" (status active, sin correo) -> ${coachName}`);
    if (APPLY) {
      const created = await createClient(fullName);
      await insertAssignment(created.id, coach.id);
    }
  }

  console.log("\n--- Reasignaciones confirmadas ---");
  for (const [email, newCoachName, oldCoachName] of REASSIGN) {
    const client = clientByEmail.get(email.toLowerCase());
    const newCoach = coachByName.get(normalizeName(newCoachName));
    const oldCoach = coachByName.get(normalizeName(oldCoachName));
    if (!client) { console.log(`! ${email}: cliente no encontrado`); continue; }

    const current = assignmentsByClient.get(client.id) || [];
    const oldAssignment = current.find((a) => a.coach_id === oldCoach.id);
    const alreadyNew = current.some((a) => a.coach_id === newCoach.id);

    console.log(
      `${client.full_name} <${email}>: ${oldCoachName} -> ${newCoachName}` +
        (oldAssignment ? "" : ` (no tenía asignación con ${oldCoachName}, no se quita nada)`) +
        (alreadyNew ? ` (ya tenía a ${newCoachName}, no se duplica)` : "")
    );

    if (APPLY) {
      if (oldAssignment) await deleteAssignment(oldAssignment.id);
      if (!alreadyNew) await insertAssignment(client.id, newCoach.id);
    }
  }

  console.log(APPLY ? "\nListo." : "\nDry run completo. Corre con --apply para ejecutar de verdad.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
