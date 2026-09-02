// Crea/actualiza los accesos simples del equipo: 1 admin + 5 coaches
// (Alex, Mari, Lorena, Ross, Jota). El login del portal usa "usuario" sin
// arroba (ver app/login/actions.ts) que internamente se resuelve a
// "<usuario>@joinaceleratalent.com" para Supabase Auth.
//
// Para cada cuenta:
//  - crea el usuario en Supabase Auth si no existe, o resetea su password si ya existe
//  - crea/actualiza su fila en `profiles` (role admin/coach)
//  - para coaches: vincula (o crea) la fila en `coaches` con profile_id
//
// Dry-run:  node scripts/setup-team-logins.mjs
// Apply:    node scripts/setup-team-logins.mjs --apply
//
// Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import fs from "node:fs";

loadEnv(".env.local");

const APPLY = process.argv.includes("--apply");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const DOMAIN = "joinaceleratalent.com";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const ACCOUNTS = [
  { username: "admin", fullName: null, role: "admin", password: "Facil123" },
  { username: "alex", fullName: "Alex", role: "coach", password: "Alex123" },
  { username: "mari", fullName: "Mari", role: "coach", password: "Mari123" },
  { username: "lorena", fullName: "Lorena", role: "coach", password: "Lorena123" },
  { username: "ross", fullName: "Ross", role: "coach", password: "Ross123" },
  { username: "jota", fullName: "Jota", role: "coach", password: "Jota123" },
];

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  const lines = fs.readFileSync(path, "utf8").split(/\n/);
  for (const line of lines) {
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

async function listAuthUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers });
  if (!res.ok) throw new Error(`listAuthUsers failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.users || data;
}

async function createAuthUser(email, password, fullName) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
    }),
  });
  if (!res.ok) throw new Error(`createAuthUser(${email}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function resetAuthPassword(userId, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`resetAuthPassword(${userId}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function upsertProfile({ id, email, fullName, role }) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ id, email, ...(fullName ? { full_name: fullName } : {}), role }]),
  });
  if (!res.ok) throw new Error(`upsertProfile(${email}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchCoaches() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/coaches?select=id,full_name,profile_id`, { headers });
  if (!res.ok) throw new Error(`fetchCoaches failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function linkCoach(coachId, profileId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/coaches?id=eq.${coachId}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ profile_id: profileId }),
  });
  if (!res.ok) throw new Error(`linkCoach(${coachId}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createCoach(fullName, profileId, email) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/coaches`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify([{ full_name: fullName, profile_id: profileId, email }]),
  });
  if (!res.ok) throw new Error(`createCoach(${fullName}) failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const authUsers = await listAuthUsers();
  const authByEmail = new Map(authUsers.map((u) => [u.email.toLowerCase(), u]));
  const coaches = await fetchCoaches();

  console.log(APPLY ? "=== APLICANDO ===" : "=== DRY RUN (usa --apply para ejecutar) ===");

  for (const account of ACCOUNTS) {
    const email = `${account.username}@${DOMAIN}`;
    const existing = authByEmail.get(email.toLowerCase());
    const action = existing ? "resetear password de" : "crear usuario";
    console.log(`\n[${account.username}] ${action} ${email} (role=${account.role}, password=${account.password})`);

    let userId = existing?.id ?? null;

    if (APPLY) {
      if (existing) {
        await resetAuthPassword(existing.id, account.password);
      } else {
        const created = await createAuthUser(email, account.password, account.fullName);
        userId = created.id;
      }
      await upsertProfile({ id: userId, email, fullName: account.fullName, role: account.role });
    }

    if (account.role === "coach") {
      const match = coaches.find((c) => (c.full_name || "").trim().toLowerCase() === account.fullName.toLowerCase());
      if (match) {
        console.log(`  -> vincular coaches.id=${match.id} (full_name="${match.full_name}") con profile_id=${userId ?? "(nuevo)"}`);
        if (APPLY && !match.profile_id) await linkCoach(match.id, userId);
        if (APPLY && match.profile_id && match.profile_id !== userId) {
          console.log(`  !! coaches.id=${match.id} ya tenía profile_id=${match.profile_id}, no se sobrescribió.`);
        }
      } else {
        console.log(`  -> crear fila nueva en coaches (full_name="${account.fullName}") con profile_id=${userId ?? "(nuevo)"}`);
        if (APPLY) await createCoach(account.fullName, userId, email);
      }
    }
  }

  console.log(APPLY ? "\nListo." : "\nDry run completo. Corre con --apply para ejecutar de verdad.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
