export function normalizeIdentity(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function matchMeetingClient(meeting, masters, clientsByMaster) {
  const invitees = meeting.external_invitees ?? meeting.calendar_invitees ?? [];
  const matches = new Map();
  const title = ` ${normalizeIdentity(meeting.meeting_title || meeting.title)} `;
  for (const master of masters) {
    const client = clientsByMaster.get(master.name);
    if (!client) continue;
    const names = [master.name, ...(master.aliases ?? []), client.full_name].map(normalizeIdentity).filter(Boolean);
    const emails = new Set([...(master.emails ?? []), client.email].filter(Boolean).map(email => email.trim().toLowerCase()));
    let reason = null;
    for (const invitee of invitees) {
      if (emails.has(String(invitee.email ?? '').trim().toLowerCase())) reason = 'invitee_email';
      else if (!reason && normalizeIdentity(invitee.name).split(' ').length >= 2 && names.includes(normalizeIdentity(invitee.name))) reason = 'invitee_name';
    }
    if (!reason && names.some(name => name.split(' ').length >= 2 && title.includes(` ${name} `))) reason = 'full_name_in_title';
    if (reason) matches.set(client.id, { client, reason });
  }
  if (matches.size === 1) return [...matches.values()][0];
  return { client: null, reason: matches.size ? 'ambiguous' : 'unmatched' };
}
