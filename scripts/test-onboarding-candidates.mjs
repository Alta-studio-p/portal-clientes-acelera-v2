import assert from 'node:assert/strict';
import { test } from 'node:test';
import { identifyOnboardingCandidates, primaryOnboardingRecording } from '../lib/onboarding-candidates.mjs';

const invitee = { name: 'Ana M. Pérez', email: 'ana@example.test' };
const day = '2026-11-05';
const make = (id, changes = {}) => ({
  fathom_call_id: id,
  title: 'AT Onboarding Ana Pérez',
  day,
  started_at: `${day}T13:00:00Z`,
  summary: '## Propósito de la reunión\n\nIntegrar a Ana Pérez al programa de Acelera.',
  raw_metadata: { external_invitees: [invitee] },
  ...changes,
});

test('two recordings of one onboarding are one candidate', () => {
  const audit = identifyOnboardingCandidates([make('1'), make('2')], []);
  assert.equal(audit.candidates.length, 1);
  assert.equal(audit.candidates[0].recordings.length, 2);
});

test('an existing primary or alternate email blocks the candidate', () => {
  for (const existing of [
    { id: 'existing', email: 'ANA@example.test' },
    { id: 'existing', alternate_emails: ['ana@example.test'] },
  ]) {
    const audit = identifyOnboardingCandidates([make('1')], [existing]);
    assert.equal(audit.candidates.length, 0);
    assert.equal(audit.review[0].reason, 'existing_client');
  }
});

test('a conflicting invitee name or multiple emails requires review', () => {
  const wrongName = make('1', { raw_metadata: { external_invitees: [{ ...invitee, name: 'Ana López' }] } });
  const extraGuest = make('2', { raw_metadata: { external_invitees: [invitee, { name: 'Luis Vera', email: 'luis@example.test' }] } });
  const audit = identifyOnboardingCandidates([wrongName, extraGuest], []);
  assert.equal(audit.candidates.length, 0);
  assert.deepEqual(audit.review.map(item => item.reason), ['invitee_name_mismatch', 'missing_or_multiple_external_emails']);
});

test('staff, demos and calls that only discuss onboarding do not create candidates', () => {
  const staff = identifyOnboardingCandidates([make('1')], [], ['ANA@example.test']);
  assert.equal(staff.candidates.length, 0);
  const audit = identifyOnboardingCandidates([
    make('2', { summary: 'Explicar las tarifas y resolver dudas.' }),
    make('3', { title: 'Demo Onboarding Ana Pérez' }),
    make('4', { raw_metadata: { internal_call: true, external_invitees: [invitee] } }),
  ], []);
  assert.equal(audit.candidates.length, 0);
  assert.equal(audit.review[0].reason, 'program_not_confirmed');
});

test('automatic intake requires evidence of one external speaker', () => {
  const options = { requireSpeaker: true };
  assert.equal(identifyOnboardingCandidates([make('1')], [], [], options).candidates.length, 0);
  const row = make('2', { raw_metadata: { external_invitees: [invitee], speaker_summary: { external: 1 } } });
  assert.equal(identifyOnboardingCandidates([row], [], [], options).candidates.length, 1);
});

test('primary coach excludes the onboarding lead and ambiguous attributions', () => {
  const record = (id) => ({ coachId: id, recordingId: id, coachResolution: 'recorded_by', needsConfirmation: false });
  const coaches = ['lead', 'a', 'b'].map(id => ({ id, bills_by_call: id !== 'lead', is_active: true }));
  assert.equal(primaryOnboardingRecording([record('lead'), record('a')], coaches), 'a');
  assert.equal(primaryOnboardingRecording([record('lead'), record('a'), record('b')], coaches), null);
});
