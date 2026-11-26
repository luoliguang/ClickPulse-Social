import test from 'node:test';
import assert from 'node:assert/strict';
import { activityRange, allowedUploadDates, assertRecoveryCode, assertWebp, defaultAvatar, generateRecoveryCodes, hashSecret, normalizeDays, normalizeNickname, normalizeRole, periodBounds } from '../src/domain';

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

test('avatar validation checks complete bounded WebP containers and defaults are stable', () => {
  const makeChunk = (type: string, payload: Buffer) => {
    const header = Buffer.alloc(8);
    header.write(type, 0);
    header.writeUInt32LE(payload.length, 4);
    return Buffer.concat([header, payload, payload.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const makeContainer = (chunks: Buffer[]) => {
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), ...chunks]);
    webp.writeUInt32LE(webp.length - 8, 4);
    return webp;
  };
  const makeVp8Chunk = (width: number, height: number) => {
    const payload = Buffer.alloc(10);
    payload.set([0x9d, 0x01, 0x2a], 3);
    payload.writeUInt16LE(width, 6);
    payload.writeUInt16LE(height, 8);
    return makeChunk('VP8 ', payload);
  };
  const makeVp8xChunk = (width: number, height: number) => {
    const payload = Buffer.alloc(10);
    payload.writeUIntLE(width - 1, 4, 3);
    payload.writeUIntLE(height - 1, 7, 3);
    return makeChunk('VP8X', payload);
  };

  const webp = makeContainer([makeVp8Chunk(256, 256)]);
  assert.equal(assertWebp(webp), webp);
  const encodedAlphaWebp = Buffer.from('UklGRmAAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSAoAAAABB9C/iAhERP8DVlA4IDAAAADQAQCdASoQABAAAgA0JaACdLoB+AADsAD+8Oj3/yC5YXXI1/8gP+QH/ID/+PIAAAA=', 'base64');
  const encodedLosslessWebp = Buffer.from('UklGRhwAAABXRUJQVlA4TA8AAAAvD8ADAAcQ0f/+ByKi/wEA', 'base64');
  assert.equal(assertWebp(encodedAlphaWebp), encodedAlphaWebp);
  assert.equal(assertWebp(encodedLosslessWebp), encodedLosslessWebp);

  assert.throws(() => assertWebp(Buffer.from('not an image')));
  assert.throws(() => assertWebp(webp.subarray(0, webp.length - 1)));
  assert.throws(() => assertWebp(makeContainer([makeVp8Chunk(0, 256)])));
  assert.throws(() => assertWebp(makeContainer([makeVp8Chunk(1025, 256)])));
  assert.throws(() => assertWebp(makeContainer([makeVp8xChunk(1025, 1), makeVp8Chunk(1, 1)])));
  assert.throws(() => assertWebp(makeContainer([makeVp8xChunk(2, 2), makeVp8Chunk(1, 1)])));
  assert.throws(() => assertWebp(makeContainer([makeVp8xChunk(1, 1), makeVp8xChunk(1, 1), makeVp8Chunk(1, 1)])));
  assert.throws(() => assertWebp(makeContainer([makeVp8Chunk(1, 1), makeVp8Chunk(1, 1)])));
  assert.deepEqual(defaultAvatar('member-1', '罗洋洋'), defaultAvatar('member-1', '罗洋洋'));
});

test('secrets are one-way hashed', () => {
  assert.equal(hashSecret('same'), hashSecret('same'));
  assert.notEqual(hashSecret('same'), hashSecret('other'));
  assert.equal(hashSecret('same').length, 64);
});

test('recovery codes are unique, opaque, and strictly validated', () => {
  const codes = generateRecoveryCodes(8);
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  for (const code of codes) {
    assert.match(code, /^RC_[A-Za-z0-9_-]{20,}$/);
    assert.equal(assertRecoveryCode(code), code);
  }
  assert.throws(() => assertRecoveryCode('invalid'), /invalid_recovery_code/);
  assert.throws(() => assertRecoveryCode('RC_short'), /invalid_recovery_code/);
  assert.throws(() => assertRecoveryCode(123), /invalid_recovery_code/);
});
