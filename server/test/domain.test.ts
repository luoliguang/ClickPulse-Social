import test from 'node:test';
import assert from 'node:assert/strict';
import { activityRange, allowedUploadDates, assertWebp, defaultAvatar, hashSecret, normalizeDays, normalizeNickname, normalizeRole, periodBounds } from '../src/domain';

test('nicknames are normalized and unsafe or oversized names are rejected', () => {
  assert.deepEqual(normalizeNickname('  Luo   Yang  '), { nickname: 'Luo Yang', key: 'luo yang' });
  for (const value of ['', '<script>', 'x'.repeat(25), null]) assert.throws(() => normalizeNickname(value));
});

test('roles fall back to other and reject unknown values', () => {
  assert.equal(normalizeRole(undefined), 'other');
  assert.equal(normalizeRole(''), 'other');
  assert.equal(normalizeRole('  developer  '), 'developer');
  assert.throws(() => normalizeRole('astronaut'));
});

test('daily payload accepts only bounded absolute totals and known Shanghai dates', () => {
  const now = new Date('2026-06-17T04:00:00Z');
  const allowed = allowedUploadDates(now);
  assert.deepEqual(normalizeDays([{ date: '2026-06-17', keyboard: 12, mouse: 3 }], allowed)[0], { date: '2026-06-17', keyboard: 12, mouse: 3 });
  assert.throws(() => normalizeDays([{ date: '2026-06-18', keyboard: 1, mouse: 1 }], allowed));
  assert.throws(() => normalizeDays([{ date: '2026-06-17', keyboard: 1, mouse: 1, key: 'A' }], allowed));
  assert.throws(() => normalizeDays([{ date: '2026-06-17', keyboard: -1, mouse: 1 }], allowed));
});

test('week is Monday through Sunday in Asia Shanghai', () => {
  const bounds = periodBounds('week', new Date('2026-06-17T04:00:00Z'));
  assert.deepEqual(bounds, { start: '2026-06-15', end: '2026-06-21' });
  assert.deepEqual(periodBounds('today', new Date('2026-06-17T20:00:00Z')), { start: '2026-06-18', end: '2026-06-18' });
});

test('activity range spans the requested trailing days and clamps to safe bounds', () => {
  assert.deepEqual(activityRange(7, new Date('2026-06-17T04:00:00Z')), { start: '2026-06-11', end: '2026-06-17' });
  assert.deepEqual(activityRange(1, new Date('2026-06-17T04:00:00Z')), { start: '2026-06-17', end: '2026-06-17' });
  assert.deepEqual(activityRange(365, new Date('2026-06-17T04:00:00Z')), { start: '2026-03-20', end: '2026-06-17' });
  assert.deepEqual(activityRange(0, new Date('2026-06-17T04:00:00Z')), { start: '2026-06-17', end: '2026-06-17' });
});

test('avatar validation checks bounded WebP signatures and defaults are stable', () => {
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from('x')]);
  assert.equal(assertWebp(webp), webp);
  assert.throws(() => assertWebp(Buffer.from('not an image')));
  assert.deepEqual(defaultAvatar('member-1', '罗洋洋'), defaultAvatar('member-1', '罗洋洋'));
});

test('secrets are one-way hashed', () => {
  assert.equal(hashSecret('same'), hashSecret('same'));
  assert.notEqual(hashSecret('same'), hashSecret('other'));
  assert.equal(hashSecret('same').length, 64);
});
