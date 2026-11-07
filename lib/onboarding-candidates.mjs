import { clientInvitees, matchClient, normalizeEmail, normalizeIdentity } from './client-matching.mjs';

const onboardingTitle = /^(?:at\s+)?on[\s-]?boarding\b[\s:–—-]*(.+)$/i;
const programPurpose = /\b(?:integrar|incorporar|dar la bienvenida|onboard)\b[\s\S]{0,150}\b(?:programa|program)\b/i;

function titleIdentity(title) {
  return String(title ?? '').trim().match(onboardingTitle)?.[1]
    .replace(/\s+(?:acelera(?: talent)?)$/i, '').trim() ?? '';
}

function agreesWithName(candidate, fullName) {
  if (String(fullName ?? '').includes('@')) return false;
  const title = normalizeIdentity(candidate).split(' ').filter(Boolean);
  const invited = normalizeIdentity(fullName).split(' ').filter(Boolean);
  if (title.length < 2 || title[0] !== invited[0]) return false;
  let offset = 0;
  for (const token of title) {
    const index = invited.indexOf(token, offset);
    if (index < 0) return false;
    offset = index + 1;
  }
  return true;
}

export function identifyOnboardingCandidates(calls, clients, staffEmails = [], { requireSpeaker = false } = {}) {
  const staff = new Set(staffEmails.map(normalizeEmail).filter(Boolean));
  const blocked = new Set();
  const grouped = new Map();
  const review = [];
  let alreadyLinked = 0;

  for (const call of calls) {
    const name = titleIdentity(call.title);
    if (!name) continue;
    const raw = call.raw_metadata ?? {};
    const invitees = clientInvitees(raw.external_invitees).filter(({ email }) => !staff.has(email));
    const distinctEmails = [...new Set(invitees.map(({ email }) => email))];
    if (call.client_id) {
      alreadyLinked += 1;
      distinctEmails.forEach(email => blocked.add(email));
      continue;
    }
    if (raw.internal_call === true) continue;
    const match = matchClient({ title: call.title, invitees }, clients);
    if (match.client || match.reason.startsWith('ambiguous')) {
      review.push({ name, day: call.day, reason: match.client ? 'existing_client' : 'ambiguous_existing_client' });
      distinctEmails.forEach(email => blocked.add(email));
      continue;
    }
    if (distinctEmails.length !== 1) {
      review.push({ name, day: call.day, reason: 'missing_or_multiple_external_emails' });
      distinctEmails.forEach(email => blocked.add(email));
      continue;
    }
    const [email] = distinctEmails;
    const namesAgree = invitees.every(({ name: inviteeName }) => agreesWithName(name, inviteeName));
    const purpose = String(call.summary ?? '').split(/^##\s+/m).slice(0, 2).join('\n').slice(0, 550);
    const explicitProgram = programPurpose.test(purpose) &&
      normalizeIdentity(purpose).includes(normalizeIdentity(name));
    if (!namesAgree || !explicitProgram) {
      review.push({ name, day: call.day, reason: namesAgree ? 'program_not_confirmed' : 'invitee_name_mismatch' });
      blocked.add(email);
      continue;
    }
    if (requireSpeaker && raw.speaker_summary?.external !== 1) {
      review.push({ name, day: call.day, reason: 'external_speaker_not_confirmed' });
      blocked.add(email);
      continue;
    }
    if (!grouped.has(email)) grouped.set(email, []);
    grouped.get(email).push({ name, day: call.day, startsAt: call.started_at, recordingId: call.fathom_call_id,
      coach: call.coach, coachId: call.coach_id, coachResolution: call.coach_resolution,
      needsConfirmation: call.coach_needs_confirmation });
  }

  const eligible = [];
  for (const [email, records] of grouped) {
    const sameIdentity = new Set(records.map(record => normalizeIdentity(record.name))).size === 1;
    if (!sameIdentity || blocked.has(email)) {
      review.push({ name: records[0].name, day: records[0].day, reason: 'conflicting_evidence' });
      continue;
    }
    eligible.push({ name: records[0].name, email, recordings: records });
  }
  const sharedNames = eligible.filter(candidate => eligible.some(other =>
    other.email !== candidate.email && normalizeIdentity(other.name) === normalizeIdentity(candidate.name)));
  sharedNames.forEach(({ name, recordings }) => review.push({ name, day: recordings[0].day, reason: 'same_name_multiple_emails' }));
  return {
    alreadyLinked,
    candidates: eligible.filter(candidate => !sharedNames.includes(candidate)),
    review: [...new Map(review.map(item => [`${normalizeIdentity(item.name)}|${item.day}|${item.reason}`, item])).values()],
  };
}

export function primaryOnboardingRecording(recordings, coaches) {
  const billable = new Set(coaches.filter(coach => coach.is_active !== false && coach.bills_by_call).map(coach => coach.id));
  const verified = recordings.filter(record => billable.has(record.coachId) &&
    record.needsConfirmation === false && ['recorded_by', 'participant'].includes(record.coachResolution));
  return new Set(verified.map(record => record.coachId)).size === 1 ? verified[0].recordingId : null;
}
