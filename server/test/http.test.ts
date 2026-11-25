import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app';
import { hashSecret } from '../src/domain';
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

test('leaderboard paginates 20 per page and pins the self entry when ranked beyond the first page', async () => {
  const originalQuery = pool.query.bind(pool);
  const rows = Array.from({ length: 24 }, (_, index) => ({ id: `member-${index + 1}`, nickname: `Member ${index + 1}`, avatar_file: null, role: 'other', keyboard: String(1000 - index), mouse: '0' }))
    .concat([{ id: 'self-id', nickname: 'Self', avatar_file: null, role: 'developer', keyboard: '1', mouse: '0' }]);
  try {
    (pool as any).query = async (sql: string) => {
      if (sql.includes('FROM leaderboard_members WHERE token_hash')) return { rows: [{ id: 'self-id', nickname: 'Self', avatar_file: null, role: 'developer', activity_visible: false }] };
      if (sql.includes('FROM leaderboard_members m JOIN leaderboard_daily_stats')) return { rows };
      throw new Error(`unexpected query ${sql}`);
    };
    const app = buildApp();
    const headers = { authorization: 'Bearer membership-token' };
    const page1 = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?period=week', headers });
    assert.equal(page1.statusCode, 200);
    const first = page1.json();
    assert.equal(first.page, 1);
    assert.equal(first.page_size, 20);
    assert.equal(first.total_entries, 25);
    assert.equal(first.total_pages, 2);
    assert.equal(first.entries.length, 20);
    assert.equal(first.self_rank, 25);
    assert.equal(first.self_entry.member_id, 'self-id');
    assert.equal(first.self_entry.rank, 25);
    assert.equal(first.self_entry.is_self, true);
    assert.equal(first.entries.some((entry: any) => entry.member_id === 'self-id'), false);
    const page2 = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?period=week&page=2', headers });
    const second = page2.json();
    assert.equal(second.page, 2);
    assert.equal(second.entries.length, 5);
    assert.equal(second.entries[4].member_id, 'self-id');
    assert.equal(second.entries[4].is_self, true);
    const clamped = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?period=week&page=99', headers });
    assert.equal(clamped.json().page, 2);
    await app.close();
  } finally {
    (pool as any).query = originalQuery;
  }
});

test('member activity requires auth and respects the public visibility toggle', async () => {
  const originalQuery = pool.query.bind(pool);
  const viewerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const missingId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const privateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const publicId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  try {
    (pool as any).query = async (sql: string, values?: unknown[]) => {
      if (sql.includes('FROM leaderboard_members WHERE token_hash')) return { rows: [{ id: viewerId, nickname: 'Viewer', avatar_file: null, role: 'other', activity_visible: false }] };
      if (sql.includes('FROM leaderboard_members WHERE id=$1')) {
        const id = values?.[0];
        if (id === missingId) return { rows: [] };
        if (id === privateId) return { rows: [{ id: privateId, nickname: 'Private', avatar_file: null, role: 'other', activity_visible: false }] };
        if (id === publicId) return { rows: [{ id: publicId, nickname: 'Public', avatar_file: null, role: 'other', activity_visible: true }] };
        return { rows: [{ id, nickname: 'Self', avatar_file: null, role: 'other', activity_visible: false }] };
      }
      if (sql.includes('FROM leaderboard_daily_stats WHERE member_id')) return { rows: [{ day: '2026-11-21', keyboard: '10', mouse: '5' }] };
      throw new Error(`unexpected query ${sql}`);
    };
    const app = buildApp();
    const headers = { authorization: 'Bearer membership-token' };
    const missing = await app.inject({ method: 'GET', url: `/api/v1/members/${missingId}/activity`, headers });
    assert.equal(missing.statusCode, 404);
    const hidden = await app.inject({ method: 'GET', url: `/api/v1/members/${privateId}/activity`, headers });
    assert.equal(hidden.statusCode, 403);
    assert.equal(hidden.json().error.code, 'activity_private');
    const visible = await app.inject({ method: 'GET', url: `/api/v1/members/${publicId}/activity?days=7`, headers });
    assert.equal(visible.statusCode, 200);
    const body = visible.json();
    assert.equal(body.member.id, publicId);
    assert.equal(body.days.length, 1);
    assert.equal(body.days[0].keyboard, 10);
    assert.equal(body.days[0].total, 15);
    const self = await app.inject({ method: 'GET', url: `/api/v1/members/${viewerId}/activity`, headers });
    assert.equal(self.statusCode, 200);
    const anonymous = await app.inject({ method: 'GET', url: `/api/v1/members/${publicId}/activity` });
    assert.equal(anonymous.statusCode, 401);
    await app.close();
  } finally {
    (pool as any).query = originalQuery;
  }
});

test('PATCH /me updates the activity visibility flag and returns it', async () => {
  const originalQuery = pool.query.bind(pool);
  try {
    (pool as any).query = async (sql: string, values?: unknown[]) => {
      if (sql.includes('FROM leaderboard_members WHERE token_hash')) return { rows: [{ id: 'self-id', nickname: 'Self', avatar_file: null, role: 'other', activity_visible: false }] };
      if (sql.startsWith('UPDATE leaderboard_members SET')) {
        assert.match(sql, /activity_visible/);
        assert.ok((values as unknown[]).includes(true));
        return { rows: [{ id: 'self-id', nickname: 'Self', avatar_file: null, role: 'other', activity_visible: true }] };
      }
      throw new Error(`unexpected query ${sql}`);
    };
    const app = buildApp();
    const updated = await app.inject({ method: 'PATCH', url: '/api/v1/me', headers: { authorization: 'Bearer membership-token' }, payload: { activity_visible: true } });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().activity_visible, true);
    const invalid = await app.inject({ method: 'PATCH', url: '/api/v1/me', headers: { authorization: 'Bearer membership-token' }, payload: { activity_visible: 'yes' } });
    assert.equal(invalid.statusCode, 400);
    await app.close();
  } finally {
    (pool as any).query = originalQuery;
  }
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
    assert.ok(Array.isArray(joined.json().recovery_codes));
    assert.equal(joined.json().recovery_codes.length, 8);
    for (const code of joined.json().recovery_codes) assert.match(code, /^RC_[A-Za-z0-9_-]{20,}$/);
    const insert = clientQueries.find(entry => entry.sql.startsWith('INSERT INTO leaderboard_members'));
    assert.equal(insert?.values?.[4], 'invite-1');
    assert.equal(insert?.values?.[5], 'designer');
    assert.ok(Array.isArray(insert?.values?.[6]));
    assert.equal((insert?.values?.[6] as string[]).length, 8);
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

test('authenticated members can replace all recovery codes, including legacy members', async () => {
  const originalQuery = pool.query.bind(pool);
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  try {
    (pool as any).query = async (sql: string, values?: unknown[]) => {
      queries.push({ sql, values });
      if (sql.includes('FROM leaderboard_members WHERE token_hash')) return { rows: [{ id: 'legacy-member', nickname: 'Legacy', avatar_file: null, role: 'other', activity_visible: false }] };
      if (sql.startsWith('UPDATE leaderboard_members SET recovery_codes_hash')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query ${sql}`);
    };
    const app = buildApp();
    const response = await app.inject({ method: 'POST', url: '/api/v1/recovery-codes', headers: { authorization: 'Bearer membership-token' }, payload: {} });
    assert.equal(response.statusCode, 200);
    const codes = response.json().recovery_codes;
    assert.equal(codes.length, 8);
    assert.equal(new Set(codes).size, 8);
    const update = queries.find(entry => entry.sql.startsWith('UPDATE leaderboard_members SET recovery_codes_hash'));
    assert.ok(update);
    assert.equal((update?.values?.[0] as string[]).length, 8);
    assert.equal((update?.values?.[0] as string[]).every(value => /^[a-f0-9]{64}$/.test(value)), true);
    await app.close();
  } finally {
    (pool as any).query = originalQuery;
  }
});

test('POST /recover validates recovery codes, rotates token, and removes the used code', async () => {
  const originalConnect = pool.connect.bind(pool);
  const clientQueries: Array<{ sql: string; values?: unknown[] }> = [];
  const recoveryCode = 'RC_validcode1234567890123456';
  const recoveryHash = hashSecret(recoveryCode);
  const fakeClient = {
    query: async (sql: string, values?: unknown[]) => {
      clientQueries.push({ sql, values });
      if (sql.includes('WHERE $1=ANY(recovery_codes_hash)')) {
        if (values?.[0] === recoveryHash) return { rows: [{ id: 'member-recovered', nickname: 'Recovered', avatar_file: null, role: 'developer', activity_visible: false, recovery_codes_hash: [recoveryHash, 'other-hash'] }] };
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE leaderboard_members SET token_hash')) return { rows: [] };
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  try {
    (pool as any).connect = async () => fakeClient;
    const app = buildApp();
    const recovered = await app.inject({ method: 'POST', url: '/api/v1/recover', payload: { recovery_code: recoveryCode } });
    assert.equal(recovered.statusCode, 200);
    const body = recovered.json();
    assert.equal(body.member.id, 'member-recovered');
    assert.equal(body.member.nickname, 'Recovered');
    assert.ok(typeof body.token === 'string');
    assert.equal(body.token.length > 20, true);
    const update = clientQueries.find(entry => entry.sql.startsWith('UPDATE leaderboard_members SET token_hash'));
    assert.ok(update);
    assert.ok(Array.isArray(update?.values?.[1]));
    assert.equal((update?.values?.[1] as string[]).includes(recoveryHash), false);
    assert.equal(clientQueries.filter(entry => entry.sql === 'COMMIT').length, 1);
    clientQueries.length = 0;
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/recover', payload: { recovery_code: 'RC_invalidcode12345678901234' } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'invalid_recovery_code');
    const malformed = await app.inject({ method: 'POST', url: '/api/v1/recover', payload: { recovery_code: 'short' } });
    assert.equal(malformed.statusCode, 400);
    await app.close();
  } finally {
    (pool as any).connect = originalConnect;
  }
});
