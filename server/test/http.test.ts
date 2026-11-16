import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app';
import { pool } from '../src/db';

test('health reports the running deployment revision after checking the database', async () => {
  const originalQuery = pool.query.bind(pool), originalRevision = process.env.CLICKPULSE_REVISION;
  try {
    (pool as any).query = async (sql: string) => {
      assert.equal(sql, 'SELECT 1');
      return { rows: [{ '?column?': 1 }] };
    };
    process.env.CLICKPULSE_REVISION = '0123456789abcdef0123456789abcdef01234567';
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true, service: 'clickpulse-leaderboard', revision: process.env.CLICKPULSE_REVISION });
    await app.close();
  } finally {
    (pool as any).query = originalQuery;
    if (originalRevision === undefined) delete process.env.CLICKPULSE_REVISION;
    else process.env.CLICKPULSE_REVISION = originalRevision;
  }
});

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

test('joining records the invitation slot and leaving releases it atomically', async () => {
  const originalQuery = pool.query.bind(pool), originalConnect = pool.connect.bind(pool);
  const clientQueries: Array<{ sql: string; values?: unknown[] }> = [];
  const fakeClient = {
    query: async (sql: string, values?: unknown[]) => {
      clientQueries.push({ sql, values });
      if (sql.startsWith('SELECT id FROM leaderboard_invitations')) return { rows: [{ id: 'invite-1' }] };
      if (sql.startsWith('DELETE FROM leaderboard_members')) return { rows: [{ invitation_id: 'invite-1' }] };
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  try {
    (pool as any).connect = async () => fakeClient;
    const app = buildApp();
    const joined = await app.inject({ method: 'POST', url: '/api/v1/join', payload: { invite_code: 'CP_123456', nickname: 'Luo', role: 'designer' } });
    assert.equal(joined.statusCode, 201);
    assert.equal(joined.json().member.role, 'designer');
    const insert = clientQueries.find(entry => entry.sql.startsWith('INSERT INTO leaderboard_members'));
    assert.equal(insert?.values?.[4], 'invite-1');
    assert.equal(insert?.values?.[5], 'designer');
    clientQueries.length = 0;
    (pool as any).query = async (sql: string) => {
      assert.match(sql, /invitation_id/);
      return { rows: [{ id: 'member-1', nickname: 'Luo', avatar_file: null, invitation_id: 'invite-1' }] };
    };
    const left = await app.inject({ method: 'DELETE', url: '/api/v1/me', headers: { authorization: 'Bearer membership-token' } });
    assert.equal(left.statusCode, 200);
    assert.ok(clientQueries.some(entry => entry.sql.startsWith('DELETE FROM leaderboard_members')));
    assert.ok(clientQueries.some(entry => entry.sql.startsWith('UPDATE leaderboard_invitations SET uses=GREATEST(0,uses-1)') && entry.values?.[0] === 'invite-1'));
    assert.equal(clientQueries.filter(entry => entry.sql === 'COMMIT').length, 1);
    await app.close();
  } finally {
    (pool as any).query = originalQuery;
    (pool as any).connect = originalConnect;
  }
});
