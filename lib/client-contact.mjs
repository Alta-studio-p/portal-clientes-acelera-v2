export function resolveClientContact(client, identity = {}) {
  const email = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : null;
  const choices = [
    ['account', email(identity.account_email)],
    ['profile', email(identity.profile_email)],
    ['contact', email(client.email)],
    ['onboarding', email(identity.onboarding_email)],
  ];
  const [source, display] = choices.find(([, value]) => value) ?? [null, null];
  return { display_email: display, registration_email: email(identity.account_email), email_source: source };
}

export function visibleClientEmail(client) {
  return client.display_email === undefined ? resolveClientContact(client).display_email : client.display_email;
}
