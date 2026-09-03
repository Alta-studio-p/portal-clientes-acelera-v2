import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const MAX_PAGES = Number(process.env.FATHOM_MAX_PAGES || 200);
const SOURCE_DELAY_MS = Number(process.env.FATHOM_SOURCE_DELAY_MS || 1200);
const INTERNAL_DOMAIN = "joinaceleratalent.com";

// fathom.video: la propia cuenta de Fathom aparece como invitado en llamadas
// demo internas ("Fathom Demo", 2021) presentes en el historial de las
// cuentas de origen. No son clientes ni coaches — sin este filtro, cada
// corrida del import las vuelve a crear como cliente fantasma aunque se
// borren a mano (ver "Susannah Durant").
const EXCLUDED_EMAIL_DOMAINS = ["fathom.video"];
const DEMO_TITLE_PATTERN = /^fathom demo$/i;

loadEnv(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const fathomSources = Object.entries(process.env)
  .map(([key, value]) => {
    const match = key.match(/^FATHOM_SOURCE_(.+)_API_KEY$/);
    if (!match || !value) return null;
    return { key: match[1].toLowerCase(), apiKey: value };
  })
  .filter(Boolean);

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

function normalizeEmail(value) {
  const email = cleanText(value).toLowerCase();
  return email.includes("@") ? email : null;
}

function titleCaseName(value) {
  return cleanText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nameFromEmail(email) {
  return titleCaseName(String(email || "").split("@")[0].replace(/[._-]+/g, " "));
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
        !EXCLUDED_EMAIL_DOMAINS.includes(invitee.domain)
    );
}

function primaryClientCandidate(meeting) {
  const invitees = externalInvitees(meeting);
  const first = invitees[0];
  if (!first) return null;
  return {
    email: first.email,
    full_name: first.name || nameFromEmail(first.email),
  };
}

function contextFromFirstCall(call) {
  const summary = cleanText(call.summary);
  if (!summary) return null;
  const title = cleanText(call.title) || "primera llamada";
  const date = call.started_at ? String(call.started_at).slice(0, 10) : "fecha no disponible";
  return `Contexto general creado desde la primera llamada registrada (${date}, ${title}).\n\n${summary}`;
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

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      limit: "100",
      include_summary: "true",
      include_action_items: "true",
    });
    if (cursor) params.set("cursor", cursor);

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

async function findClientByEmail(email) {
  if (!email) return null;
  const rows = await sb(`clients?select=id,email,full_name,context_summary&email=eq.${encodeURIComponent(email)}&limit=1`);
  return rows[0] || null;
}

async function upsertClient(candidate) {
  if (!candidate?.email) return null;
  const existing = await findClientByEmail(candidate.email);
  if (existing) return existing;

  if (!APPLY) {
    return { id: `dry-client:${candidate.email}`, email: candidate.email, full_name: candidate.full_name };
  }

  const rows = await sb("clients?on_conflict=email", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      email: candidate.email,
      full_name: candidate.full_name,
      status: "active",
    }),
  });
  return rows[0] || null;
}

async function upsertCall(row) {
  if (!APPLY) return null;
  const rows = await sb("calls?on_conflict=fathom_call_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
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

async function main() {
  const coaches = await readCoaches();
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

      const candidate = primaryClientCandidate(meeting);
      const client = candidate ? await upsertClient(candidate) : null;
      if (client?.id) stats.withClient += 1;
      else stats.withoutClient += 1;

      const summary = getSummary(meeting);
      const nextSteps = getNextSteps(meeting);
      if (summary) stats.withSummary += 1;

      const row = {
        client_id: client?.id && !String(client.id).startsWith("dry-client:") ? client.id : null,
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
        if (coach?.id && row.client_id) {
          await ensureAssignment(coach.id, row.client_id);
          stats.assignments += 1;
        }
      }
    }
  }

  const contextsUpdated = await refreshClientContexts();

  console.log(`Reuniones leidas: ${stats.meetings}`);
  console.log(`Reuniones con cliente detectado: ${stats.withClient}`);
  console.log(`Reuniones sin cliente claro: ${stats.withoutClient}`);
  console.log(`Reuniones con resumen: ${stats.withSummary}`);
  console.log(APPLY ? `Llamadas insertadas/actualizadas: ${stats.imported}` : "Modo prueba: no se modifico Supabase");
  console.log(APPLY ? `Asignaciones coach-cliente tocadas: ${stats.assignments}` : "");
  console.log(APPLY ? `Contextos de cliente creados: ${contextsUpdated}` : "");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
