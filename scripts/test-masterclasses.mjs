import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMasterclassRelative, isNewMasterclass, masterclassCategory, masterclassDrivePreview, masterclassDriveUrl, masterclassLiveUrl, masterclassLocalInput, masterclassResources, parseMasterclass } from '../lib/masterclasses.mjs';

const now = Date.parse('2026-11-06T17:00:00Z');
const meet = 'https://meet.google.com/abc-defg-hij';
const drive = 'https://drive.google.com/file/d/example_video-id/view?resourcekey=example';

function read(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: 'Clase de IA',
    category: 'ai',
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

test('category is required and limited to the three library sections', () => {
  assert.throws(() => read({ category: '' }), /categoría/);
  assert.throws(() => read({ category: 'caro' }), /categoría/);
  assert.equal(read({ category: 'executive_lab' }).category, 'executive_lab');
  assert.equal(masterclassCategory('caro'), 'ai');
  assert.equal(masterclassCategory(null), 'ai');
});

test('guides may skip the live date and publish with materials only', () => {
  const guide = read({ category: 'guides', status: 'recording', starts_at: '', duration_minutes: '', live_url: '', resources: 'Plantilla | https://docs.google.com/document/d/x\nhttps://example.com/guia.pdf' });
  assert.equal(guide.startsAt, null);
  assert.equal(guide.duration, null);
  assert.deepEqual(guide.resources, [
    { title: 'Plantilla', url: 'https://docs.google.com/document/d/x' },
    { title: 'example.com', url: 'https://example.com/guia.pdf' },
  ]);
  assert.throws(() => read({ category: 'guides', status: 'recording', starts_at: '', live_url: '' }), /material/);
  assert.throws(() => read({ category: 'guides', status: 'scheduled' }), /guías/);
  assert.throws(() => read({ category: 'ai', starts_at: '' }), /fecha/);
  assert.throws(() => read({ resources: 'Mal | http://example.com' }), /https/);
  assert.deepEqual(masterclassResources([{ title: 'x', url: 'javascript:alert(1)' }, 'nope']), []);
});

test('relative dates and the "new" badge', () => {
  assert.equal(formatMasterclassRelative('2026-11-06T12:00:00Z', now), 'hoy');
  assert.equal(formatMasterclassRelative('2026-11-03T16:00:00Z', now), 'hace 3 días');
  assert.match(formatMasterclassRelative('2026-10-23T16:00:00Z', now), /^23 oct 2026$/);
  assert.equal(isNewMasterclass('2026-11-01T17:00:00Z', now), true);
  assert.equal(isNewMasterclass('2026-10-30T16:00:00Z', now), false);
  assert.equal(isNewMasterclass(null, now), false);
});

test('calendar helpers use Colombia time and Monday-first month grids', async () => {
  const { masterclassDayKey, formatMasterclassTime, masterclassMonthGrid } = await import('../lib/masterclasses.mjs');
  // 00:30 UTC del día 27 sigue siendo 26 en Colombia (UTC-5).
  assert.equal(masterclassDayKey('2026-11-27T00:30:00Z'), '2026-11-26');
  assert.match(formatMasterclassTime('2026-11-27T00:30:00Z'), /^7:30\s?p\.\s?m\.$/);
  const nov = masterclassMonthGrid(2026, 11); // 1 nov 2026 es domingo
  assert.equal(nov.length % 7, 0);
  assert.equal(nov.indexOf('2026-11-01'), 6);
  assert.equal(nov.filter(Boolean).length, 30);
  assert.equal(masterclassMonthGrid(2026, 2).filter(Boolean).length, 28);
});
