// Limpieza puntual confirmada por el usuario:
//  - Susannah Durant (susannah.durant@fathom.video): cuenta demo de Fathom
//    (3 llamadas "Fathom Demo" de 2021), no es cliente real. Se borra
//    completa (llamadas + participantes + asignaciones + cliente).
//  - Alfonso Arango Osorio (alfonso.arango@uniminuto.edu): confirmado que no
//    es cliente. 1 llamada asociada, se borra completa junto con él.
//  - "Lucy Chacón" fantasma (alex.vega@cmglobalconsulting.com, cuenta
//    fantasma ya documentada en el proyecto): tiene 40 llamadas reales que
//    probablemente pertenecen a varios clientes distintos mezclados. NO se
//    borra el cliente ni sus llamadas (requiere revisión caso a caso). Solo
//    se quita la asignación duplicada a Mari, dejando a Alex.
//
// Dry-run:  node scripts/cleanup-ghost-clients.mjs
// Apply:    node scripts/cleanup-ghost-clients.mjs --apply

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

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function getJson(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function del(path) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status} ${await res.text()}`);
}

async function deleteClientCompletely(email) {
  const [client] = await getJson(`/rest/v1/clients?email=eq.${encodeURIComponent(email)}&select=id,full_name`);
  if (!client) {
    console.log(`! ${email}: no encontrado, se omite`);
    return;
  }

  const calls = await getJson(`/rest/v1/calls?client_id=eq.${client.id}&select=id`);
  console.log(`${client.full_name} <${email}>: borrar ${calls.length} llamada(s), sus participantes, asignaciones y el cliente`);

  if (!APPLY) return;

  for (const call of calls) {
    await del(`/rest/v1/call_participants?call_id=eq.${call.id}`);
  }
  if (calls.length) {
    await del(`/rest/v1/calls?client_id=eq.${client.id}`);
  }
  await del(`/rest/v1/coach_client_assignments?client_id=eq.${client.id}`);
  await del(`/rest/v1/clients?id=eq.${client.id}`);
}

async function removeDuplicateAssignment(email, coachFullName) {
  const [client] = await getJson(`/rest/v1/clients?email=eq.${encodeURIComponent(email)}&select=id,full_name`);
  if (!client) {
    console.log(`! ${email}: no encontrado, se omite`);
    return;
  }
  const [coach] = await getJson(`/rest/v1/coaches?full_name=eq.${encodeURIComponent(coachFullName)}&select=id`);
  const assignments = await getJson(
    `/rest/v1/coach_client_assignments?client_id=eq.${client.id}&coach_id=eq.${coach.id}&select=id`
  );

  if (!assignments.length) {
    console.log(`${client.full_name} <${email}>: no tenía asignación a ${coachFullName}, nada que quitar`);
    return;
  }

  console.log(`${client.full_name} <${email}>: quitar asignación duplicada a ${coachFullName} (se conserva el cliente, sus llamadas y la asignación a Alex)`);
  if (APPLY) await del(`/rest/v1/coach_client_assignments?id=eq.${assignments[0].id}`);
}

async function main() {
  console.log(APPLY ? "=== APLICANDO ===\n" : "=== DRY RUN (usa --apply para ejecutar) ===\n");

  await deleteClientCompletely("susannah.durant@fathom.video");
  await deleteClientCompletely("alfonso.arango@uniminuto.edu");
  await removeDuplicateAssignment("alex.vega@cmglobalconsulting.com", "Mari");

  console.log(APPLY ? "\nListo." : "\nDry run completo. Corre con --apply para ejecutar de verdad.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
