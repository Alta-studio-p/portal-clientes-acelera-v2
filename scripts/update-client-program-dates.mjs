// Actualiza status + start_date/end_date para los 59 clientes indicados por
// el usuario (26 ACTIVO + 33 FINALIZADO). El mapeo nombre -> cliente fue
// resuelto a mano (ver reporte en consola) comparando nombres sin tildes,
// mayúsculas ni espacios duplicados contra los 40 clientes reales en la
// base. No crea clientes nuevos ni toca pagos/notas/etapas/responsables.
//
// Mapeo de estado: ACTIVO -> status "active" (ya existente), FINALIZADO ->
// status "inactive" (ya existente, es el único status "no activo" del
// enum). No se agrega ni se quita ningún valor de status.
//
// Para clientes sin fecha de inicio confirmada por el usuario, se usa como
// fallback la fecha real de la primera llamada registrada
// (`context_source_call_id` -> calls.started_at, el mismo dato que ya
// muestra la UI como "Primera llamada"). Nunca se usa `created_at`. Si no
// hay ninguna llamada registrada, la fecha queda vacía.
//
// Dry-run:  node scripts/update-client-program-dates.mjs
// Apply:    node scripts/update-client-program-dates.mjs --apply

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

function addThreeMonthsSameDay(startDate) {
  const [year, month, day] = startDate.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + 3, day));
  return result.toISOString().slice(0, 10);
}

// target name -> email real en `clients` (resuelto a mano, ver mensaje al usuario)
const ACTIVO = {
  "Maria Lindarte": "maria.andrealp@gmail.com",
  "Natalia Palacio": "natalia.palacio.ch@gmail.com",
  "Mariano Garcia": "marianogarc0981@gmail.com",
  "Manuel Huyo": "manuelhuyo@outlook.com",
  "Walter de Andrade": "walterdeandrade@gmail.com",
  "Carolina Cortes": "carolcortes83@gmail.com",
  "Oscar Eduardo Rivera": "oscarivera19@gmail.com",
  "Diana Maria Palacio": "dianampalaciog@gmail.com",
  "Guillermo Plazas": null,
  "Jenny Sarmiento": "jass710@hotmail.com",
  "Carolina Henao": "carolinahenaor@gmail.com",
  "Lucy Chacon": "lucychacon75@gmail.com",
  "Diego Cortes": "diegocortes1@hotmail.com",
  "Sergio Cobos": "mari.aceleratalent@gmail.com",
  "Laura Ximena": "lximenahenaor@gmail.com",
  "Luis Javier Garzon": "luisjaviergarzon93@gmail.com",
  "Felipe Castillo": "felipe.castillo.genard@gmail.com",
  "Juan Sebastian Rosas": null,
  "Elkin Ospina": null,
  "Juan David Ospina": "juandagutierrez1@hotmail.com",
  "Andres Torres": "giovanny.torres.a@hotmail.com",
  "Nestor Serrano": null,
  "Omar Arenas": null,
  "Deccy Duarte": "duartedeccy@gmail.com",
  "Juan Felipe Muñoz": null,
  "Julian Ramirez": null,
};

const FINALIZADO = {
  Beto: null,
  "Felipe Uribe": null,
  "Camilo Martinez": null,
  Gina: null,
  "Jhon Casas": null,
  Deysi: null,
  "Carlos Herreño": null,
  "Javier Florez": null,
  "Leonardo Cardenas": null,
  "Marialejandra Blanco": null,
  "Harold Arteaga Sanchez": null,
  "Adriana Prosperi": null,
  "Paola Alvarez": "paola.alvarez.zuluaga@gmail.com",
  "Camilo Vivi": null,
  "Andrés Felipe Giraldo": "afgiraldo80@gmail.com",
  "Diego Hernando Angulo": null,
  "Alejandra Montoya": "amontoya0109@gmail.com",
  "Juan Pablo Marquez": null,
  "Oscar Fuentes": null,
  "Luisa Galvez": null,
  "Enrique Chirinos": "enrique_chirinos@hotmail.com",
  "Juan Guillermo Jaramillo": null,
  "Carolina Rodriguez": "carola1720@msn.com",
  "Diego Andres Correa": "diecor365@gmail.com",
  "Carlos Posada": "carlosaposada2002@gmail.com",
  "Jaime Andrés Torres Plaza": "jaimeplaza@gmail.com",
  "Juan Camilo Penagos": "campenagos@gmail.com",
  "Orlando Lopez": null,
  "Diana Ramirez": "dira145mar@hotmail.com",
  "Jose Luis Silva": "joseluis.silva@pepsico.com",
  "Fabian Cardenas": null,
  "Luis Felipe Hernandez": "luisfelipe.hernandez@outlook.com",
  "Alvaro Bustos": "liderfinanciero.alvarobustos@gmail.com",
};

// fechas de inicio confirmadas por el usuario (target name -> YYYY-MM-DD)
const CONFIRMED_DATES = {
  Gina: "2026-02-26",
  Deysi: "2026-03-02",
  "Carlos Herreño": "2026-03-03",
  "Javier Florez": "2026-03-11",
  "Leonardo Cardenas": "2026-03-10",
  "Marialejandra Blanco": "2026-03-17",
  "Harold Arteaga Sanchez": "2026-03-16",
  "Adriana Prosperi": "2026-03-16",
  "Paola Alvarez": "2026-03-25",
  "Camilo Vivi": "2026-04-01",
  "Andrés Felipe Giraldo": "2026-04-01",
  "Diego Hernando Angulo": "2026-04-06",
  "Alejandra Montoya": "2026-04-08",
  "Juan Pablo Marquez": "2026-04-08",
  "Oscar Fuentes": "2026-04-14",
  "Luisa Galvez": "2026-04-13",
  "Enrique Chirinos": "2026-04-16",
  "Juan Guillermo Jaramillo": "2026-04-23",
  "Carolina Rodriguez": "2026-04-28",
  "Diego Andres Correa": "2026-05-04",
  "Carlos Posada": "2026-05-07",
  "Jaime Andrés Torres Plaza": "2026-05-12",
  "Juan Camilo Penagos": "2026-05-15",
  "Orlando Lopez": "2026-05-16",
  "Diana Ramirez": "2026-05-19",
  "Jose Luis Silva": "2026-05-20",
  "Fabian Cardenas": "2026-05-22",
  "Luis Felipe Hernandez": "2026-05-21",
  "Alvaro Bustos": "2026-06-01",
  "Maria Lindarte": "2026-06-02",
  "Natalia Palacio": "2026-06-02",
  "Mariano Garcia": "2026-06-04",
  "Manuel Huyo": "2026-06-10",
  "Walter de Andrade": "2026-06-04",
  "Carolina Cortes": "2026-06-16",
  "Oscar Eduardo Rivera": "2026-06-19",
  "Diana Maria Palacio": "2026-06-22",
};

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function fetchClients() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=id,full_name,email,status,start_date,end_date,context_source_call_id`,
    { headers }
  );
  if (!res.ok) throw new Error(`fetchClients failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchCallDate(callId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/calls?id=eq.${callId}&select=started_at`, { headers });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.started_at ? rows[0].started_at.slice(0, 10) : null;
}

async function updateClient(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateClient(${id}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createClient(patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify([patch]),
  });
  if (!res.ok) throw new Error(`createClient(${patch.full_name}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const clients = await fetchClients();
  const byEmail = new Map(clients.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]));
  const byNormalizedName = new Map(clients.map((c) => [normalizeName(c.full_name), c]));

  const plan = [];
  const unmatched = [];

  for (const [statusLabel, statusValue, list] of [
    ["ACTIVO", "active", ACTIVO],
    ["FINALIZADO", "inactive", FINALIZADO],
  ]) {
    for (const [targetName, email] of Object.entries(list)) {
      if (!email) {
        unmatched.push({ targetName, statusLabel, statusValue });
        continue;
      }
      const client = byEmail.get(email.toLowerCase());
      if (!client) {
        unmatched.push({ targetName, statusLabel, statusValue, note: `email ${email} no encontrado` });
        continue;
      }
      plan.push({ targetName, statusLabel, statusValue, client });
    }
  }

  console.log(APPLY ? "=== APLICANDO ===" : "=== DRY RUN (usa --apply para ejecutar) ===");
  console.log(`\nClientes a actualizar: ${plan.length} / 59. Sin match: ${unmatched.length}.\n`);

  for (const item of plan) {
    const confirmedStart = CONFIRMED_DATES[item.targetName] ?? null;
    let startDate = confirmedStart;
    let startSource = confirmedStart ? "confirmada" : null;

    if (!startDate) {
      // ya tenía una fecha cargada de una corrida anterior del script
      if (item.client.start_date) {
        startDate = item.client.start_date;
        startSource = "ya cargada";
      } else if (item.client.context_source_call_id) {
        const callDate = await fetchCallDate(item.client.context_source_call_id);
        if (callDate) {
          startDate = callDate;
          startSource = "primera llamada real";
        }
      }
    }

    const endDate = startDate ? addThreeMonthsSameDay(startDate) : item.client.end_date;

    item.startDate = startDate;
    item.endDate = endDate;
    item.startSource = startSource ?? "sin fecha disponible";

    console.log(
      `[${item.statusLabel}] ${item.targetName} -> ${item.client.full_name} <${item.client.email}> | status: ${item.client.status} -> ${item.statusValue} | start_date: ${startDate ?? "(vacío)"} (${item.startSource}) | end_date: ${endDate ?? "(vacío)"}`
    );

    if (APPLY) {
      await updateClient(item.client.id, {
        status: item.statusValue,
        start_date: startDate,
        end_date: endDate,
      });
    }
  }

  console.log(`\n=== SIN MATCH — se crean como clientes nuevos, solo con nombre (sin correo) ===`);
  for (const u of unmatched) {
    const already = byNormalizedName.get(normalizeName(u.targetName));
    if (already) {
      console.log(`[${u.statusLabel}] ${u.targetName} -> ya existe (creado en una corrida anterior), se omite`);
      continue;
    }

    const confirmedStart = CONFIRMED_DATES[u.targetName] ?? null;
    const endDate = confirmedStart ? addThreeMonthsSameDay(confirmedStart) : null;

    console.log(
      `[${u.statusLabel}] crear "${u.targetName}" | status: ${u.statusValue} | start_date: ${confirmedStart ?? "(vacío)"} | end_date: ${endDate ?? "(vacío)"}`
    );

    if (APPLY) {
      await createClient({
        full_name: u.targetName,
        status: u.statusValue,
        start_date: confirmedStart,
        end_date: endDate,
      });
    }
  }

  console.log(APPLY ? "\nListo." : "\nDry run completo. Corre con --apply para ejecutar de verdad.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
