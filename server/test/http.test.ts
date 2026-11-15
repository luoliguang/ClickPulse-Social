import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app';

test('strict request schemas reject unexpected activity fields before database access', async () => {
  const app = buildApp();
  const join = await app.inject({ method: 'POST', url: '/api/v1/join', payload: { invite_code: 'ABCDEF', nickname: 'Luo', typed_text: 'never' } });
  assert.equal(join.statusCode, 400);
  assert.equal(join.json().error.code, 'invalid_request');
  const stats = await app.inject({ method: 'PUT', url: '/api/v1/stats', payload: { days: [], app_name: 'never' } });
  assert.equal(stats.statusCode, 400);
  assert.equal(stats.json().error.code, 'invalid_request');
  await app.close();
});
