import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from './db';
import { allowedUploadDates, assertInvite, assertWebp, defaultAvatar, hashSecret, normalizeDays, normalizeNickname, periodBounds } from './domain';

const avatarRoot = process.env.AVATAR_ROOT || join(process.cwd(), 'avatars');
const publicBase = (process.env.PUBLIC_BASE || 'https://clickpulse.fangdutex.cn').replace(/\/$/, '');
const limiter = new Map<string, { count: number; reset: number }>();

type MemberRow = { id: string; nickname: string; avatar_file: string | null };

function limited(key: string, maximum: number, windowMs: number): boolean {
  const now = Date.now();
  if (limiter.size > 10_000) {
    for (const [candidate, value] of limiter) if (value.reset <= now) limiter.delete(candidate);
  }
  const current = limiter.get(key);
  if (!current || current.reset <= now) { limiter.set(key, { count: 1, reset: now + windowMs }); return false; }
  current.count += 1;
  return current.count > maximum;
}

function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<MemberRow | undefined> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length > 256) { fail(reply, 401, 'unauthorized', 'Membership token is required'); return; }
  const token = header.slice(7);
  const result = await pool.query<MemberRow>('SELECT id,nickname,avatar_file FROM leaderboard_members WHERE token_hash=$1', [hashSecret(token)]);
  if (!result.rows[0]) { fail(reply, 401, 'unauthorized', 'Membership token is invalid'); return; }
  return result.rows[0];
}

function avatar(member: MemberRow) {
  const value = defaultAvatar(member.id, member.nickname);
  if (member.avatar_file) value.url = `${publicBase}/api/v1/avatar/${member.id}?v=${member.avatar_file.slice(0, 8)}`;
  return value;
}

function memberJson(member: MemberRow) {
  return { id: member.id, nickname: member.nickname, avatar: avatar(member) };
}

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 256 * 1024,
    trustProxy: '127.0.0.1',
    ajv: { customOptions: { removeAdditional: false } },
  });
  app.addContentTypeParser('image/webp', { parseAs: 'buffer', bodyLimit: 200 * 1024 }, (_request, body, done) => done(null, body));

  app.get('/api/v1/health', async () => {
    await pool.query('SELECT 1');
    return { ok: true, service: 'clickpulse-leaderboard' };
  });

  app.post('/api/v1/join', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['invite_code', 'nickname'], properties: { invite_code: { type: 'string', minLength: 6, maxLength: 64 }, nickname: { type: 'string', minLength: 1, maxLength: 96 } } } }
  }, async (request, reply) => {
    if (limited(`join:${request.ip}`, 10, 60 * 60_000)) return fail(reply, 429, 'rate_limited', 'Too many join attempts');
    try {
      const body = request.body as { invite_code: unknown; nickname: unknown };
      const code = assertInvite(body.invite_code);
      const { nickname, key } = normalizeNickname(body.nickname);
      const token = randomBytes(32).toString('base64url');
      const id = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const invitation = await client.query<{ id: string }>('SELECT id FROM leaderboard_invitations WHERE code_hash=$1 AND uses<max_uses AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE', [hashSecret(code)]);
        if (!invitation.rows[0]) { await client.query('ROLLBACK'); return fail(reply, 400, 'invalid_invite', 'Invitation code is invalid or exhausted'); }
        await client.query('INSERT INTO leaderboard_members(id,nickname,nickname_key,token_hash) VALUES($1,$2,$3,$4)', [id, nickname, key, hashSecret(token)]);
        await client.query('UPDATE leaderboard_invitations SET uses=uses+1 WHERE id=$1', [invitation.rows[0].id]);
        await client.query('COMMIT');
      } catch (error: any) {
        await client.query('ROLLBACK');
        if (error?.code === '23505') return fail(reply, 409, 'nickname_taken', 'Nickname is already in use');
        throw error;
      } finally { client.release(); }
      return reply.code(201).send({ member: memberJson({ id, nickname, avatar_file: null }), token });
    } catch (error: any) {
      if (['invalid_invite', 'invalid_nickname'].includes(error?.message)) return fail(reply, 400, error.message, 'Invalid invitation code or nickname');
      throw error;
    }
  });

  app.get('/api/v1/me', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    return memberJson(member);
  });

  app.patch('/api/v1/me', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['nickname'], properties: { nickname: { type: 'string', minLength: 1, maxLength: 96 } } } }
  }, async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    try {
      const { nickname, key } = normalizeNickname((request.body as { nickname: unknown }).nickname);
      const result = await pool.query<MemberRow>('UPDATE leaderboard_members SET nickname=$1,nickname_key=$2,updated_at=NOW() WHERE id=$3 RETURNING id,nickname,avatar_file', [nickname, key, member.id]);
      return memberJson(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return fail(reply, 409, 'nickname_taken', 'Nickname is already in use');
      if (error?.message === 'invalid_nickname') return fail(reply, 400, 'invalid_nickname', 'Nickname is invalid');
      throw error;
    }
  });

  app.put('/api/v1/stats', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['days'], properties: { days: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['date', 'keyboard', 'mouse'], properties: { date: { type: 'string' }, keyboard: { type: 'integer', minimum: 0 }, mouse: { type: 'integer', minimum: 0 } } } } } } }
  }, async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    if (limited(`stats:${member.id}`, 30, 10 * 60_000)) return fail(reply, 429, 'rate_limited', 'Statistics are syncing too frequently');
    try {
      const days = normalizeDays((request.body as { days: unknown }).days, allowedUploadDates());
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const day of days) {
          const updated = await client.query('INSERT INTO leaderboard_daily_stats(member_id,day,keyboard,mouse) VALUES($1,$2,$3,$4) ON CONFLICT(member_id,day) DO UPDATE SET keyboard=EXCLUDED.keyboard,mouse=EXCLUDED.mouse,updated_at=NOW() WHERE EXCLUDED.keyboard>=leaderboard_daily_stats.keyboard AND EXCLUDED.mouse>=leaderboard_daily_stats.mouse RETURNING member_id', [member.id, day.date, day.keyboard, day.mouse]);
          if (updated.rowCount !== 1) {
            await client.query('ROLLBACK');
            return fail(reply, 409, 'stats_decreased', 'Daily statistics cannot decrease');
          }
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      return { ok: true, synced: days.length };
    } catch (error: any) {
      if (error?.message === 'invalid_stats') return fail(reply, 400, 'invalid_stats', 'Statistics payload is invalid');
      throw error;
    }
  });

  app.get('/api/v1/leaderboard', {
    schema: { querystring: { type: 'object', additionalProperties: false, required: ['period'], properties: { period: { type: 'string', enum: ['today', 'week'] } } } }
  }, async (request, reply) => {
    if (limited(`board:${request.ip}`, 120, 60_000)) return fail(reply, 429, 'rate_limited', 'Leaderboard is refreshing too frequently');
    const period = (request.query as { period: 'today' | 'week' }).period;
    const bounds = periodBounds(period);
    let selfId: string | undefined;
    if (request.headers.authorization) {
      const member = await authenticate(request, reply); if (!member) return;
      selfId = member.id;
    }
    const result = await pool.query<MemberRow & { keyboard: string; mouse: string }>(`SELECT m.id,m.nickname,m.avatar_file,COALESCE(SUM(s.keyboard),0)::text keyboard,COALESCE(SUM(s.mouse),0)::text mouse FROM leaderboard_members m JOIN leaderboard_daily_stats s ON s.member_id=m.id AND s.day BETWEEN $1 AND $2 GROUP BY m.id,m.nickname,m.avatar_file HAVING SUM(s.keyboard+s.mouse)>0 ORDER BY SUM(s.keyboard+s.mouse) DESC,m.created_at ASC LIMIT 100`, [bounds.start, bounds.end]);
    const entries = result.rows.map((row, index) => ({ rank: index + 1, member_id: row.id, nickname: row.nickname, avatar: avatar(row), keyboard: Number(row.keyboard), mouse: Number(row.mouse), total: Number(row.keyboard) + Number(row.mouse), is_self: row.id === selfId }));
    return { period, starts_on: bounds.start, ends_on: bounds.end, entries, self_rank: entries.find(entry => entry.is_self)?.rank ?? null };
  });

  app.get('/api/v1/avatar/:memberId', async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    if (!/^[0-9a-f-]{36}$/.test(memberId)) return fail(reply, 404, 'not_found', 'Avatar not found');
    const result = await pool.query<{ avatar_file: string | null }>('SELECT avatar_file FROM leaderboard_members WHERE id=$1', [memberId]);
    const file = result.rows[0]?.avatar_file;
    if (!file) return fail(reply, 404, 'not_found', 'Avatar not found');
    try {
      const bytes = await readFile(join(avatarRoot, file));
      return reply.header('Cache-Control', 'public, max-age=300').type('image/webp').send(bytes);
    } catch { return fail(reply, 404, 'not_found', 'Avatar not found'); }
  });

  app.post('/api/v1/avatar', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    if (limited(`avatar:${member.id}`, 10, 60 * 60_000)) return fail(reply, 429, 'rate_limited', 'Avatar is changing too frequently');
    try {
      const bytes = assertWebp(request.body);
      await mkdir(avatarRoot, { recursive: true });
      const file = `${randomUUID()}.webp`, staged = join(avatarRoot, `.${file}.tmp`);
      await writeFile(staged, bytes, { flag: 'wx', mode: 0o600 });
      const published = join(avatarRoot, file);
      await rename(staged, published);
      try {
        await pool.query('UPDATE leaderboard_members SET avatar_file=$1,updated_at=NOW() WHERE id=$2', [file, member.id]);
      } catch (error) {
        await rm(published, { force: true });
        throw error;
      }
      if (member.avatar_file) await rm(join(avatarRoot, member.avatar_file), { force: true });
      return memberJson({ ...member, avatar_file: file });
    } catch (error: any) {
      if (error?.message === 'invalid_avatar') return fail(reply, 400, 'invalid_avatar', 'Avatar must be a WebP image up to 200 KB');
      throw error;
    }
  });

  app.delete('/api/v1/avatar', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    await pool.query('UPDATE leaderboard_members SET avatar_file=NULL,updated_at=NOW() WHERE id=$1', [member.id]);
    if (member.avatar_file) await rm(join(avatarRoot, member.avatar_file), { force: true });
    return { ok: true };
  });

  app.delete('/api/v1/me', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    await pool.query('DELETE FROM leaderboard_members WHERE id=$1', [member.id]);
    if (member.avatar_file) await rm(join(avatarRoot, member.avatar_file), { force: true });
    return { ok: true };
  });

  app.setErrorHandler((error, _request, reply) => {
    if ((error as any).validation) return fail(reply, 400, 'invalid_request', 'Request payload is invalid');
    app.log.error(error);
    return fail(reply, 500, 'internal_error', 'The leaderboard is temporarily unavailable');
  });
  return app;
}
