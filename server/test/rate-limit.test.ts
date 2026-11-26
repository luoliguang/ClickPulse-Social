import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedWindowLimiter } from '../src/app';

test('fixed-window limiter enforces request boundaries and resets expired keys', () => {
  let now = 1_000;
  const limiter = new FixedWindowLimiter(2, () => now);

  assert.equal(limiter.isLimited('a', 2, 100), false);
  assert.equal(limiter.isLimited('a', 2, 100), false);
  assert.equal(limiter.isLimited('a', 2, 100), true);
  assert.equal(limiter.isLimited('b', 1, 100), false);
  assert.equal(limiter.size, 2);

  now = 1_100;
  limiter.deleteExpired();
  assert.equal(limiter.size, 0);
  assert.equal(limiter.isLimited('a', 2, 100), false);
});

test('fixed-window limiter fails closed at capacity without evicting active limits', () => {
  const limiter = new FixedWindowLimiter(2, () => 1_000);

  assert.equal(limiter.isLimited('a', 1, 1_000), false);
  assert.equal(limiter.isLimited('b', 1, 1_000), false);
  assert.equal(limiter.isLimited('c', 1, 1_000), true);
  assert.equal(limiter.size, 2);
  assert.equal(limiter.isLimited('a', 1, 1_000), true);
  assert.equal(limiter.isLimited('c', 1, 1_000), true);
});
