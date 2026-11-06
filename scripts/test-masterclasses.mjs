import assert from 'node:assert/strict';
import { test } from 'node:test';
import { masterclassDrivePreview, masterclassDriveUrl, masterclassLiveUrl, masterclassLocalInput, parseMasterclass } from '../lib/masterclasses.mjs';

const now = Date.parse('2026-11-06T17:00:00Z');
const meet = 'https://meet.google.com/abc-defg-hij';
const drive = 'https://drive.google.com/file/d/example_video-id/view?resourcekey=example';

function read(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: 'Clase de IA',
    starts_at: '2026-11-07T19:00',
    duration_minutes: '60',
    status: 'scheduled',
    live_url: meet,
    ...overrides,
  })) form.set(key, value);
  return parseMasterclass(form, now);
}

test('hora de Colombia round-trips across UTC midnight', () => {
  const { startsAt } = read();
  assert.equal(startsAt, '2026-11-08T00:00:00.000Z');
  assert.equal(masterclassLocalInput(startsAt), '2026-11-07T19:00');
  assert.throws(() => read({ starts_at: '2026-02-30T10:00' }));
  assert.throws(() => read({ starts_at: '2026-11-07T24:00' }));
});

test('published entries require an appropriate link', () => {
  assert.throws(() => read({ live_url: '' }));
  assert.throws(() => read({ status: 'recording', drive_url: drive }));
  assert.throws(() => read({ status: 'recording', starts_at: '2026-11-05T10:00' }));
  assert.equal(read({ status: 'recording', starts_at: '2026-11-05T10:00', drive_url: drive }).drive, drive);
  assert.equal(read({ status: 'recording', starts_at: '2026-11-05T10:00', drive_url: drive, duration_minutes: '' }).duration, null);
  assert.throws(() => read({ duration_minutes: '' }));
  assert.equal(read({ status: 'draft', live_url: '' }).live, null);
  assert.equal(read({ status: 'cancelled', live_url: '' }).live, null);
});

test('links reject lookalike hosts, redirects and non-HTTPS URLs', () => {
  assert.equal(masterclassDriveUrl(drive), drive);
  assert.equal(masterclassDrivePreview(drive + '&usp=sharing'), 'https://drive.google.com/file/d/example_video-id/preview?resourcekey=example');
  assert.equal(masterclassDrivePreview('https://example.com/file/d/example/view'), null);
  assert.equal(masterclassLiveUrl(meet), meet);
  assert.equal(masterclassLiveUrl('https://us02web.zoom.us/j/12345?pwd=example'), 'https://us02web.zoom.us/j/12345?pwd=example');
  assert.equal(masterclassDriveUrl('https://drive.google.com.evil.test/file/d/example/view'), null);
  assert.equal(masterclassDriveUrl('https://drive.google.com/drive/folders/example'), null);
  assert.equal(masterclassLiveUrl('https://meet.google.com/redirect?to=https://evil.test'), null);
  assert.equal(masterclassLiveUrl('http://meet.google.com/abc-defg-hij'), null);
  assert.equal(masterclassLiveUrl('https://meet.google.com@evil.test/abc-defg-hij'), null);
});
