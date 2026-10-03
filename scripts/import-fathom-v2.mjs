import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const MAX_PAGES = Number(process.env.FATHOM_MAX_PAGES || 200);
const SOURCE_DELAY_MS = Number(process.env.FATHOM_SOURCE_DELAY_MS || 1200);
const INTERNAL_DOMAIN = "joinaceleratalent.com";
const ONLY_SOURCE = (
  process.env.FATHOM_ONLY_SOURCE ||
  process.argv.find((arg) => arg.startsWith("--source="))?.split("=")[1] ||
  ""
).trim().toLowerCase();

// fathom.video: la propia cuenta de Fathom aparece como invitado en llamadas
// demo internas ("Fathom Demo", 2021) presentes en el historial de las
// cuentas de origen. No son clientes ni coaches — sin este filtro, cada
// corrida del import las vuelve a crear como cliente fantasma aunque se
// borren a mano (ver "Susannah Durant").
const EXCLUDED_EMAIL_DOMAINS = ["fathom.video"];
// Correos de agenda/genéricos que Fathom a veces mete como invitado junto al
// cliente real. Nunca pertenecen a la lista maestra y no deben asociar una
// llamada a un cliente.
const EXCLUDED_EMAILS = [
  "mari.aceleratalent@gmail.com",
  "rlconsultalent@gmail.com",
  "rosa.aceleratalent@gmail.com",
  "alex.vega@cmglobalconsulting.com",
  "jonathan.aceleratalent@gmail.com",
];
const DEMO_TITLE_PATTERN = /^fathom demo$/i;

const MASTER_CLIENTS = JSON.parse(
  fs.readFileSync(new URL("../data/master-clients.json", import.meta.url), "utf8"),
);

loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const fathomSources = Object.entries(process.env)
  .map(([key, value]) => {
    const match = key.match(/^FATHOM_SOURCE_(.+)_API_KEY$/);
    if (!match || !value) return null;
    return { key: match[1].toLowerCase(), apiKey: value };
  })
  .filter(Boolean)
  .filter((source) => !ONLY_SOURCE || source.key === ONLY_SOURCE);

if (!SUPABASE_URL || !SUPABASE_KEY || fathomSources.length === 0) {
  console.error("Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y FATHOM_SOURCE_*_API_KEY.");
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value || "").trim();
}

function sourceEnvPrefix(sourceKey) {
  return `BACKFILL_SOURCE_${sourceKey.toUpperCase()}`;
}

function parseDateStart(value) {
  const clean = cleanText(value);
  if (!clean) return null;
  const date = clean.includes("T") ? new Date(clean) : new Date(`${clean}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createdAfterForSource(sourceKey) {
  const prefix = sourceEnvPrefix(sourceKey);
  const fromDate = parseDateStart(process.env[`${prefix}_FROM_DATE`]);
  if (fromDate) return fromDate.toISOString();

  const todayOnly = process.env[`${prefix}_TODAY`] === "1";
  if (todayOnly) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }

  const days = Number(process.env[`${prefix}_DAYS`] || 0);
  if (days > 0) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  return null;
}

function normalizeEmail(value) {
  const email = cleanText(value).toLowerCase();
  return email.includes("@") ? email : null;
}

function dateFromMeeting(meeting) {
  return meeting.scheduled_start_time || meeting.recording_start_time || meeting.created_at || null;
}

function durationSeconds(meeting) {
  const start = meeting.recording_start_time ? new Date(meeting.recording_start_time).getTime() : null;
  const end = meeting.recording_end_time ? new Date(meeting.recording_end_time).getTime() : null;
  if (!start || !end || Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.round((end - start) / 1000);
}

function getSummary(meeting) {
  return cleanText(
    meeting.default_summary?.markdown_formatted ||
      meeting.summary?.markdown_formatted ||
      meeting.default_summary?.text ||
      meeting.summary?.text,
  );
}

function getNextSteps(meeting) {
  const actionItems = meeting.action_items || meeting.actionItems || meeting.next_steps || meeting.nextSteps;
  if (Array.isArray(actionItems)) {
    return actionItems
      .map((item) => {
        if (typeof item === "string") return item;
        return item.text || item.description || item.title || item.action_item || "";
      })
      .map(cleanText)
      .filter(Boolean)
      .map((item) => `- ${item}`)
      .join("\n");
  }
  return cleanText(actionItems);
}

function externalInvitees(meeting) {
  const invitees = Array.isArray(meeting.calendar_invitees) ? meeting.calendar_invitees : [];
  return invitees
    .map((invitee) => ({
      email: normalizeEmail(invitee.email),
      name: cleanText(invitee.name),
      domain: cleanText(invitee.email_domain || String(invitee.email || "").split("@")[1]).toLowerCase(),
    }))
    .filter(
      (invitee) =>
        invitee.email &&
        invitee.domain !== INTERNAL_DOMAIN &&
        !EXCLUDED_EMAIL_DOMAINS.includes(invitee.domain) &&
        !EXCLUDED_EMAILS.includes(invitee.email)
    );
}

function normalizeIdentity(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findMasterClient({ name, email }) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const byEmail = MASTER_CLIENTS.find((client) => client.emails?.includes(normalizedEmail));
    if (byEmail) return byEmail;
  }

  const normalizedName = normalizeIdentity(name);
  if (!normalizedName) return null;
  return (
    MASTER_CLIENTS.find((client) => normalizeIdentity(client.name) === normalizedName) ??
    MASTER_CLIENTS.find((client) => client.aliases?.some((alias) => normalizeIdentity(alias) === normalizedName)) ??
    null
  );
}

function contextFromFirstCall(call) {
  const summary = cleanText(call.summary);
  if (!summary) return null;
  const title = cleanText(call.title) || "primera llamada";
  const date = call.started_at ? String(call.started_at).slice(0, 10) : "fecha no disponible";
  return `Contexto general creado desde la primera llamada registrada (${date}, ${title}).\n\n${summary}`;
}

function addThreeMonths(startDate) {
  const [year, month, day] = startDate.split("-").map(Number);
  return new Date(Date.UTC(year, month + 2, day)).toISOString().slice(0, 10);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
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

async function fathomGet(source, path) {
  const response = await fetch(`https://api.fathom.ai/external/v1/${path}`, {
    headers: { "X-Api-Key": source.apiKey },
  });
  if (response.status === 429) {
    await wait(65_000);
    return fathomGet(source, path);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fathom ${source.key} ${response.status}: ${text}`);
  }
  return response.json();
}

async function listMeetings(source) {
  const meetings = [];
  let cursor = null;
  const createdAfter = createdAfterForSource(source.key);

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      limit: "100",
      include_summary: "true",
      include_action_items: "true",
    });
    if (cursor) params.set("cursor", cursor);
    if (createdAfter) params.set("created_after", createdAfter);

    const data = await fathomGet(source, `meetings?${params.toString()}`);
    const items = Array.isArray(data.items) ? data.items : [];
    meetings.push(...items.map((meeting) => ({ ...meeting, source_key: source.key })));
    cursor = data.next_cursor;
    if (!cursor || items.length === 0) break;
  }

  return meetings;
}

async function readCoaches() {
  const rows = await sb("coaches?select=id,email,full_name,fathom_source_key");
  return new Map(rows.map((coach) => [coach.fathom_source_key, coach]));
}

async function readMasterClients() {
  const rows = await sb("clients?select=id,email,full_name,context_summary");
  const byName = new Map(rows.map((client) => [normalizeIdentity(client.full_name), client]));
  const byEmail = new Map(rows.filter((client) => client.email).map((client) => [client.email.toLowerCase(), client]));
  const masterClients = new Map();

  for (const master of MASTER_CLIENTS) {
    const client =
      byName.get(normalizeIdentity(master.name)) ??
      master.aliases?.map((alias) => byName.get(normalizeIdentity(alias))).find(Boolean) ??
      master.emails?.map((email) => byEmail.get(email)).find(Boolean) ??
      null;
    if (client) masterClients.set(master.name, client);
  }

  return masterClients;
}

function clientForMeeting(meeting, masterClients) {
  for (const invitee of externalInvitees(meeting)) {
    const master = findMasterClient(invitee);
    const client = master ? masterClients.get(master.name) : null;
    if (client) return client;
  }
  return null;
}

async function findCallByFathomId(fathomCallId) {
  const rows = await sb(`calls?select=id,client_id&fathom_call_id=eq.${encodeURIComponent(fathomCallId)}&limit=1`);
  return rows[0] || null;
}

async function upsertCall(row) {
  if (!APPLY) return null;

  // Si la llamada ya existe y ya tiene cliente asignado, no se lo pisamos —
  // el importador solo decide el cliente la primera vez que ve la llamada.
  // Sin esto, una corrección manual (ej. reasignar una llamada mal atribuida
  // a una cuenta fantasma) se revierte sola la próxima vez que esta llamada
  // caiga dentro de la ventana de backfill del cron nocturno.
  const existing = await findCallByFathomId(row.fathom_call_id);
  const payload = { ...row };
  if (existing?.client_id) {
    delete payload.client_id;
  }

  const rows = await sb("calls?on_conflict=fathom_call_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload),
  });
  return rows[0] || null;
}

async function upsertParticipants(callId, meeting) {
  if (!APPLY || !callId) return;
  const invitees = Array.isArray(meeting.calendar_invitees) ? meeting.calendar_invitees : [];
  const participants = invitees
    .filter((invitee) => !EXCLUDED_EMAIL_DOMAINS.includes(String(invitee.email || "").split("@")[1]?.toLowerCase()))
    .map((invitee) => ({
      call_id: callId,
      email: normalizeEmail(invitee.email),
      name: cleanText(invitee.name) || null,
      role_hint: normalizeEmail(invitee.email)?.endsWith(`@${INTERNAL_DOMAIN}`) ? "internal" : "client",
    }))
    .filter((participant) => participant.email);

  if (!participants.length) return;
  await sb("call_participants?on_conflict=call_id,email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(participants),
  });
}

async function ensureAssignment(coachId, clientId) {
  if (!APPLY || !coachId || !clientId) return;
  await sb("coach_client_assignments?on_conflict=coach_id,client_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ coach_id: coachId, client_id: clientId, is_primary: true }),
  });
}

async function refreshClientContexts() {
  if (!APPLY) return 0;
  const clients = await sb("clients?select=id,context_summary");
  let updated = 0;

  for (const client of clients) {
    if (cleanText(client.context_summary)) continue;
    const calls = await sb(
      `calls?select=id,title,started_at,summary&client_id=eq.${encodeURIComponent(client.id)}&summary=not.is.null&order=started_at.asc.nullslast&limit=1`,
    );
    const firstCall = calls[0];
    const context = contextFromFirstCall(firstCall || {});
    if (!context) continue;

    await sb(`clients?id=eq.${encodeURIComponent(client.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        first_call_id: firstCall.id,
        context_source_call_id: firstCall.id,
        context_summary: context,
        context_generated_at: new Date().toISOString(),
      }),
    });
    updated += 1;
  }

  return updated;
}

async function refreshProgramDates(masterClients) {
  if (!APPLY) return 0;
  const clientIds = [...masterClients.values()].map((client) => client.id);
  if (!clientIds.length) return 0;

  const calls = await sb(
    `calls?select=client_id,started_at&client_id=in.(${clientIds.join(",")})&started_at=not.is.null&order=started_at.asc`,
  );
  const firstCallByClient = new Map();
  for (const call of calls) {
    if (!firstCallByClient.has(call.client_id)) firstCallByClient.set(call.client_id, String(call.started_at).slice(0, 10));
  }

  let updated = 0;
  for (const client of masterClients.values()) {
    const startDate = firstCallByClient.get(client.id) ?? null;
    const endDate = startDate ? addThreeMonths(startDate) : null;
    const status = endDate && endDate < todayDate() ? "inactive" : "active";
    await sb(`clients?id=eq.${encodeURIComponent(client.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ start_date: startDate, end_date: endDate, status }),
    });
    updated += 1;
  }
  return updated;
}

async function main() {
  const coaches = await readCoaches();
  const masterClients = await readMasterClients();
  const stats = {
    meetings: 0,
    withClient: 0,
    withoutClient: 0,
    withSummary: 0,
    imported: 0,
    assignments: 0,
  };

  for (const source of fathomSources) {
    const coach = coaches.get(source.key);
    if (!coach) {
      console.log(`Sin coach configurado para ${source.key}; se importaran llamadas sin coach_id.`);
    }

    await wait(SOURCE_DELAY_MS);
    const meetings = await listMeetings(source);
    console.log(`${source.key}: ${meetings.length} reuniones leidas`);
    stats.meetings += meetings.length;

    for (const meeting of meetings) {
      const rawTitle = cleanText(meeting.meeting_title || meeting.title);
      if (DEMO_TITLE_PATTERN.test(rawTitle)) {
        stats.meetings -= 1; // no cuenta como reunion real importada/omitida
        continue;
      }

      const client = clientForMeeting(meeting, masterClients);
      if (client?.id) stats.withClient += 1;
      else stats.withoutClient += 1;

      const summary = getSummary(meeting);
      const nextSteps = getNextSteps(meeting);
      if (summary) stats.withSummary += 1;

      const row = {
        client_id: client?.id ?? null,
        coach_id: coach?.id || null,
        source: "fathom",
        fathom_call_id: String(meeting.recording_id),
        title: cleanText(meeting.meeting_title || meeting.title) || "Llamada Fathom",
        started_at: dateFromMeeting(meeting),
        duration_seconds: durationSeconds(meeting),
        summary: summary || null,
        next_steps: nextSteps || null,
        recording_url: meeting.url || null,
        share_url: meeting.share_url || null,
        raw_metadata: {
          source_key: source.key,
          calendar_invitees_domains_type: meeting.calendar_invitees_domains_type,
          transcript_language: meeting.transcript_language,
          created_at: meeting.created_at,
          scheduled_start_time: meeting.scheduled_start_time,
          scheduled_end_time: meeting.scheduled_end_time,
          recording_start_time: meeting.recording_start_time,
          recording_end_time: meeting.recording_end_time,
          external_invitees: externalInvitees(meeting),
        },
      };

      const savedCall = await upsertCall(row);
      if (APPLY) {
        stats.imported += 1;
        await upsertParticipants(savedCall?.id, meeting);
        // Usar el client_id que realmente quedó en la fila (puede ser el que
        // ya tenía antes, preservado por upsertCall), no el que se acaba de
        // adivinar — evita crear asignaciones coach-cliente con un cliente
        // equivocado.
        const finalClientId = savedCall?.client_id ?? row.client_id;
        if (coach?.id && finalClientId) {
          await ensureAssignment(coach.id, finalClientId);
          stats.assignments += 1;
        }
      }
    }
  }

  const contextsUpdated = await refreshClientContexts();
  const datesUpdated = await refreshProgramDates(masterClients);

  console.log(`Reuniones leidas: ${stats.meetings}`);
  console.log(`Reuniones con cliente detectado: ${stats.withClient}`);
  console.log(`Reuniones sin cliente claro: ${stats.withoutClient}`);
  console.log(`Reuniones con resumen: ${stats.withSummary}`);
  console.log(APPLY ? `Llamadas insertadas/actualizadas: ${stats.imported}` : "Modo prueba: no se modifico Supabase");
  console.log(APPLY ? `Asignaciones coach-cliente tocadas: ${stats.assignments}` : "");
  console.log(APPLY ? `Contextos de cliente creados: ${contextsUpdated}` : "");
  console.log(APPLY ? `Fechas y estado recalculados: ${datesUpdated}` : "");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
