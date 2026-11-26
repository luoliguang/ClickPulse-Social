import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('legacy invitation migration preserves historical usage counts', async () => {
  const schema = await readFile(join(process.cwd(), 'src', 'schema.sql'), 'utf8');
  assert.match(schema, /ADD COLUMN invitation_id TEXT REFERENCES leaderboard_invitations/);
  assert.doesNotMatch(schema, /UPDATE\s+leaderboard_invitations\s+SET\s+uses\s*=\s*0/i);
});
