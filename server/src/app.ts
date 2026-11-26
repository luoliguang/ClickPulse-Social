import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ADMIN_APP_JS, ADMIN_HTML, cookieValue, createAdminSession, generateInviteCode, verifyAdminSession, verifyPassword } from './admin';
import { pool } from './db';
import { activityRange, allowedUploadDates, assertInvite, assertRecoveryCode, assertWebp, defaultAvatar, generateRecoveryCodes, hashSecret, normalizeDays, normalizeNickname, normalizeRole, periodBounds } from './domain';

const avatarRoot = process.env.AVATAR_ROOT || join(process.cwd(), 'avatars');
const updateRoot = () => process.env.UPDATE_ROOT || join(process.cwd(), 'updates');
const publicBase = (process.env.PUBLIC_BASE || 'https://clickpulse.fangdutex.cn').replace(/\/$/, '');
const adminCookie = 'clickpulse_admin';
const updateTargets = ['windows-x64', 'macos-arm64', 'macos-x64', 'linux-arm64', 'linux-x64'];

type MemberRow = { id: string; nickname: string; avatar_file: string | null; invitation_id?: string | null; role: string; activity_visible: boolean };
type AuthContext = MemberRow & { device_id: string; device_name: string };
type DeviceRow = { id: string; name: string; created_at: string; last_seen_at: string; current: boolean };
type InvitationRow = { id: string; max_uses: number; uses: number; expires_at: string | null; revoked_at: string | null; created_at: string; expired: boolean };
type RemoveFile = (path: string, options: { force: boolean }) => Promise<void>;

const avatarFilePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;
function avatarFilePath(file: string): string | undefined {
  return avatarFilePattern.test(file) ? join(avatarRoot, file) : undefined;
}

export class FixedWindowLimiter {
  private readonly entries = new Map<string, { count: number; reset: number }>();

  constructor(private readonly capacity = 10_000, private readonly now = Date.now) {}

  isLimited(key: string, maximum: number, windowMs: number): boolean {
    const now = this.now();
    const current = this.entries.get(key);
    if (current && current.reset > now) {
      current.count += 1;
      return current.count > maximum;
    }
    if (current) this.entries.delete(key);
    if (this.entries.size >= this.capacity) return true;
    this.entries.set(key, { count: 1, reset: now + windowMs });
    return false;
  }

  deleteExpired(): void {
    const now = this.now();
    for (const [key, value] of this.entries) {
      if (value.reset <= now) this.entries.delete(key);
    }
  }

  get size(): number { return this.entries.size; }
}

const limiter = new FixedWindowLimiter();
setInterval(() => limiter.deleteExpired(), 60_000).unref();

function fail(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<AuthContext | undefined> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length > 256) { fail(reply, 401, 'unauthorized', 'Membership token is required'); return; }
  const token = header.slice(7);
  const result = await pool.query<AuthContext>("WITH active AS (SELECT id,member_id,name FROM leaderboard_devices WHERE token_hash=$1), touched AS (UPDATE leaderboard_devices SET last_seen_at=NOW() FROM active WHERE leaderboard_devices.id=active.id AND leaderboard_devices.last_seen_at<=NOW()-INTERVAL '10 minutes' RETURNING leaderboard_devices.id) SELECT m.id,m.nickname,m.avatar_file,m.invitation_id,m.role,m.activity_visible,active.id AS device_id,active.name AS device_name FROM active JOIN leaderboard_members m ON m.id=active.member_id", [hashSecret(token)]);
  if (!result.rows[0]) { fail(reply, 401, 'unauthorized', 'Membership token is invalid'); return; }
  return result.rows[0];
}

function deviceNameFromRequest(request: FastifyRequest): string {
  const userAgent = request.headers['user-agent'] || '';
  const match = /ClickPulse\/[\d.]+ \(([^)]*)\)/.exec(userAgent);
  return (match?.[1] ?? '').trim().slice(0, 64);
}

function avatar(member: MemberRow) {
  const value = defaultAvatar(member.id, member.nickname);
  if (member.avatar_file) value.url = `${publicBase}/api/v1/avatar/${member.id}?v=${member.avatar_file.slice(0, 8)}`;
  return value;
}

function memberJson(member: MemberRow) {
  return { id: member.id, nickname: member.nickname, role: member.role, activity_visible: member.activity_visible, avatar: avatar(member) };
}

function sameOrigin(request: FastifyRequest): boolean {
  return request.headers.origin === publicBase;
}

function adminAuthenticated(request: FastifyRequest): boolean {
  return verifyAdminSession(cookieValue(request.headers.cookie, adminCookie), process.env.ADMIN_PASSWORD_HASH);
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  if (adminAuthenticated(request)) return true;
  fail(reply, 401, 'admin_unauthorized', 'Admin sign-in is required');
  return false;
}

function adminCookieHeader(value: string, maxAge: number): string {
  return `${adminCookie}=${value}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function buildApp(options: { removeFile?: RemoveFile } = {}) {
  const app = Fastify({
    logger: true,
    bodyLimit: 256 * 1024,
    trustProxy: '127.0.0.1',
    ajv: { customOptions: { removeAdditional: false } },
  });
  const boardCache = new Map<string, { expires: number; starts_on: string; ends_on: string; entries: Array<{ rank: number; member_id: string; nickname: string; role: string; avatar: ReturnType<typeof avatar>; keyboard: number; mouse: number; total: number }> }>();
  const boardCacheMs = 10_000;
  const removeFile = options.removeFile ?? rm;
  const removePath = async (request: FastifyRequest, path: string, operation: string): Promise<void> => {
    try {
      await removeFile(path, { force: true });
    } catch (error) {
      request.log.error({ err: error, path, operation }, 'avatar file cleanup failed');
    }
  };
  const removeAvatarFile = async (request: FastifyRequest, file: string | null, operation: string): Promise<void> => {
    if (!file) return;
    const path = avatarFilePath(file);
    if (!path) {
      request.log.error({ avatar_file: file, operation }, 'refusing to remove an invalid avatar file name');
      return;
    }
    await removePath(request, path, operation);
  };
  app.addContentTypeParser('image/webp', { parseAs: 'buffer', bodyLimit: 200 * 1024 }, (_request, body, done) => done(null, body));

  app.get('/api/v1/health', async () => {
    await pool.query('SELECT 1');
    return { ok: true, service: 'clickpulse-leaderboard', revision: process.env.CLICKPULSE_REVISION || 'unknown' };
  });

  app.get('/api/v1/updates/latest', async (_request, reply) => {
    try {
      const bytes = await readFile(join(updateRoot(), 'latest.json'));
      if (bytes.length > 1024 * 1024) throw new Error('update metadata is too large');
      const metadata = JSON.parse(bytes.toString('utf8'));
      return reply.header('Cache-Control', 'no-store').send(metadata);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return fail(reply, 404, 'update_unavailable', 'No mirrored update is available');
      throw error;
    }
  });

  app.get('/api/v1/updates/download/:version/:file', {
    schema: { params: { type: 'object', additionalProperties: false, required: ['version', 'file'], properties: { version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' }, file: { type: 'string', minLength: 1, maxLength: 128 } } } }
  }, async (request, reply) => {
    const { version, file } = request.params as { version: string; file: string };
    const allowed = new Set(['SHA256SUMS.txt', ...updateTargets.flatMap(target => [`ClickPulse-${version}-${target}.zip`, `ClickPulse-${version}-${target}.manifest.json`]), `ClickPulse-${version}-macos-arm64.dmg`, `ClickPulse-${version}-macos-x64.dmg`]);
    if (!allowed.has(file)) return fail(reply, 404, 'not_found', 'Update file not found');
    const path = join(updateRoot(), `v${version}`, file);
    try {
      const info = await stat(path);
      if (!info.isFile()) return fail(reply, 404, 'not_found', 'Update file not found');
      return reply.header('Cache-Control', 'public, max-age=31536000, immutable').header('Content-Length', info.size).type('application/octet-stream').send(createReadStream(path));
    } catch (error: any) {
      if (error?.code === 'ENOENT') return fail(reply, 404, 'not_found', 'Update file not found');
      throw error;
    }
  });

  app.get('/admin', async (_request, reply) => {
    if (!process.env.ADMIN_PASSWORD_HASH) return fail(reply, 404, 'not_found', 'Not found');
    return reply.header('Cache-Control', 'no-store').header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'").type('text/html; charset=utf-8').send(ADMIN_HTML);
  });

  app.get('/admin/app.js', async (_request, reply) => {
    if (!process.env.ADMIN_PASSWORD_HASH) return fail(reply, 404, 'not_found', 'Not found');
    return reply.header('Cache-Control', 'no-store').header('Content-Security-Policy', "default-src 'none'").type('application/javascript; charset=utf-8').send(ADMIN_APP_JS);
  });

  app.post('/admin/api/session', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['password'], properties: { password: { type: 'string', minLength: 1, maxLength: 256 } } } }
  }, async (request, reply) => {
    if (!process.env.ADMIN_PASSWORD_HASH) return fail(reply, 404, 'not_found', 'Not found');
    if (!sameOrigin(request)) return fail(reply, 403, 'invalid_origin', 'The request origin is not allowed');
    if (limiter.isLimited(`admin-login:${request.ip}`, 10, 60 * 60_000)) return fail(reply, 429, 'rate_limited', 'Too many sign-in attempts');
    const password = (request.body as { password: unknown }).password;
    if (!verifyPassword(password, process.env.ADMIN_PASSWORD_HASH)) return fail(reply, 401, 'admin_unauthorized', 'Password is incorrect');
    const session = createAdminSession(process.env.ADMIN_PASSWORD_HASH);
    return reply.header('Set-Cookie', adminCookieHeader(session, 8 * 60 * 60)).send({ ok: true });
  });

  app.delete('/admin/api/session', async (request, reply) => {
    if (!sameOrigin(request)) return fail(reply, 403, 'invalid_origin', 'The request origin is not allowed');
    return reply.header('Set-Cookie', adminCookieHeader('', 0)).send({ ok: true });
  });

  app.get('/admin/api/invitations', async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const result = await pool.query<InvitationRow>('SELECT id,max_uses,uses,expires_at,revoked_at,created_at,(expires_at IS NOT NULL AND expires_at<=NOW()) expired FROM leaderboard_invitations ORDER BY created_at DESC LIMIT 200');
    return { invitations: result.rows.map(row => ({ ...row, remaining: Math.max(0, row.max_uses - row.uses) })) };
  });

  app.post('/admin/api/invitations', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['max_uses', 'valid_days', 'count'], properties: { max_uses: { type: 'integer', minimum: 1, maximum: 1000 }, valid_days: { type: 'integer', minimum: 1, maximum: 3650 }, count: { type: 'integer', minimum: 1, maximum: 20 } } } }
  }, async (request, reply) => {
    if (!sameOrigin(request)) return fail(reply, 403, 'invalid_origin', 'The request origin is not allowed');
    if (!requireAdmin(request, reply)) return;
    if (limiter.isLimited('admin-invite', 60, 60 * 60_000)) return fail(reply, 429, 'rate_limited', 'Invitations are being generated too frequently');
    const { max_uses, valid_days, count } = request.body as { max_uses: number; valid_days: number; count: number };
    const codes = Array.from({ length: count }, generateInviteCode);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const code of codes) await client.query("INSERT INTO leaderboard_invitations(id,code_hash,max_uses,expires_at) VALUES($1,$2,$3,NOW()+($4||' days')::interval)", [randomUUID(), hashSecret(code), max_uses, String(valid_days)]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    return reply.code(201).send({ codes });
  });

  app.delete('/admin/api/invitations/:id', {
    schema: { params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', pattern: '^[0-9a-f-]{36}$' } } } }
  }, async (request, reply) => {
    if (!sameOrigin(request)) return fail(reply, 403, 'invalid_origin', 'The request origin is not allowed');
    if (!requireAdmin(request, reply)) return;
    const result = await pool.query('UPDATE leaderboard_invitations SET revoked_at=COALESCE(revoked_at,NOW()) WHERE id=$1 RETURNING id', [(request.params as { id: string }).id]);
    if (!result.rows[0]) return fail(reply, 404, 'not_found', 'Invitation not found');
    return { ok: true };
  });

  app.post('/api/v1/join', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['invite_code', 'nickname'], properties: { invite_code: { type: 'string', minLength: 6, maxLength: 64 }, nickname: { type: 'string', minLength: 1, maxLength: 96 }, role: { type: 'string', minLength: 1, maxLength: 32 } } } }
  }, async (request, reply) => {
    if (limiter.isLimited(`join:${request.ip}`, 10, 60 * 60_000)) return fail(reply, 429, 'rate_limited', 'Too many join attempts');
    try {
      const body = request.body as { invite_code: unknown; nickname: unknown; role?: unknown };
      const code = assertInvite(body.invite_code);
      const { nickname, key } = normalizeNickname(body.nickname);
      const role = normalizeRole(body.role);
      const token = randomBytes(32).toString('base64url');
      const recoveryCodes = generateRecoveryCodes();
      const id = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const invitation = await client.query<{ id: string }>('SELECT id FROM leaderboard_invitations WHERE code_hash=$1 AND uses<max_uses AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE', [hashSecret(code)]);
        if (!invitation.rows[0]) { await client.query('ROLLBACK'); return fail(reply, 400, 'invalid_invite', 'Invitation code is invalid or exhausted'); }
        await client.query('INSERT INTO leaderboard_members(id,nickname,nickname_key,invitation_id,role,recovery_codes_hash) VALUES($1,$2,$3,$4,$5,$6)', [id, nickname, key, invitation.rows[0].id, role, recoveryCodes.map(hashSecret)]);
        await client.query('INSERT INTO leaderboard_devices(id,member_id,token_hash,name) VALUES($1,$2,$3,$4)', [randomUUID(), id, hashSecret(token), deviceNameFromRequest(request)]);
        await client.query('UPDATE leaderboard_invitations SET uses=uses+1 WHERE id=$1', [invitation.rows[0].id]);
        await client.query('COMMIT');
      } catch (error: any) {
        await client.query('ROLLBACK');
        if (error?.code === '23505') return fail(reply, 409, 'nickname_taken', 'Nickname is already in use');
        throw error;
      } finally { client.release(); }
      return reply.code(201).send({ member: memberJson({ id, nickname, avatar_file: null, role, activity_visible: false }), token, recovery_codes: recoveryCodes });
    } catch (error: any) {
      if (['invalid_invite', 'invalid_nickname', 'invalid_role'].includes(error?.message)) return fail(reply, 400, error.message, 'Invalid invitation code, nickname, or role');
      throw error;
    }
  });

  app.post('/api/v1/recover', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['recovery_code'], properties: { recovery_code: { type: 'string', minLength: 20, maxLength: 128 } } } }
  }, async (request, reply) => {
    if (limiter.isLimited(`recover:${request.ip}`, 5, 60 * 60_000)) return fail(reply, 429, 'rate_limited', 'Too many recovery attempts');
    try {
      const code = assertRecoveryCode((request.body as { recovery_code: unknown }).recovery_code);
      const hash = hashSecret(code);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query<MemberRow & { recovery_codes_hash: string[] }>('SELECT id,nickname,avatar_file,role,activity_visible,recovery_codes_hash FROM leaderboard_members WHERE $1=ANY(recovery_codes_hash) FOR UPDATE', [hash]);
        const member = result.rows[0];
        if (!member) { await client.query('ROLLBACK'); return fail(reply, 400, 'invalid_recovery_code', 'Recovery code is invalid or has already been used'); }
        const token = randomBytes(32).toString('base64url');
        await client.query('UPDATE leaderboard_members SET recovery_codes_hash=$1,updated_at=NOW() WHERE id=$2', [member.recovery_codes_hash.filter(value => value !== hash), member.id]);
        await client.query('INSERT INTO leaderboard_devices(id,member_id,token_hash,name) VALUES($1,$2,$3,$4)', [randomUUID(), member.id, hashSecret(token), deviceNameFromRequest(request)]);
        await client.query('COMMIT');
        boardCache.clear();
        const stats = await pool.query<{ day: string; keyboard: string; mouse: string }>('SELECT day::text AS day, keyboard, mouse FROM leaderboard_daily_stats WHERE member_id=$1 ORDER BY day ASC', [member.id]);
        return { member: memberJson(member), token, recovery_stats: { days: stats.rows.map(row => ({ day: row.day, keyboard: Number(row.keyboard), mouse: Number(row.mouse) })) } };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    } catch (error: any) {
      if (error?.message === 'invalid_recovery_code') return fail(reply, 400, 'invalid_recovery_code', 'Recovery code format is invalid');
      throw error;
    }
  });

  app.post('/api/v1/recovery-codes', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    if (limiter.isLimited(`recovery-codes:${member.id}`, 3, 60 * 60_000)) return fail(reply, 429, 'rate_limited', 'Recovery codes are being regenerated too frequently');
    const codes = generateRecoveryCodes();
    await pool.query('UPDATE leaderboard_members SET recovery_codes_hash=$1,updated_at=NOW() WHERE id=$2', [codes.map(hashSecret), member.id]);
    return { recovery_codes: codes };
  });

  app.get('/api/v1/me', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    return memberJson(member);
  });

  app.get('/api/v1/devices', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    const result = await pool.query<DeviceRow>('SELECT id,name,created_at,last_seen_at,(id=$1) AS current FROM leaderboard_devices WHERE member_id=$2 ORDER BY created_at ASC', [member.device_id, member.id]);
    return { devices: result.rows };
  });

  app.delete('/api/v1/devices/:id', {
    schema: { params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', minLength: 1, maxLength: 64 } } } }
  }, async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    const { id } = request.params as { id: string };
    if (id === member.device_id) return fail(reply, 400, 'cannot_remove_current_device', 'Sign out instead of removing the current device');
    const result = await pool.query('DELETE FROM leaderboard_devices WHERE id=$1 AND member_id=$2 RETURNING id', [id, member.id]);
    if (!result.rows[0]) return fail(reply, 404, 'not_found', 'Device not found');
    return { ok: true };
  });

  app.patch('/api/v1/me', {
    schema: { body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { nickname: { type: 'string', minLength: 1, maxLength: 96 }, role: { type: 'string', minLength: 1, maxLength: 32 }, activity_visible: { type: 'boolean' } } } }
  }, async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    try {
      const body = request.body as { nickname?: unknown; role?: unknown; activity_visible?: unknown };
      const updates: string[] = [];
      const values: unknown[] = [];
      if (body.nickname !== undefined) {
        const { nickname, key } = normalizeNickname(body.nickname);
        values.push(nickname, key);
        updates.push(`nickname=$${values.length - 1}`, `nickname_key=$${values.length}`);
      }
      if (body.role !== undefined) {
        values.push(normalizeRole(body.role));
        updates.push(`role=$${values.length}`);
      }
      if (body.activity_visible !== undefined) {
        if (typeof body.activity_visible !== 'boolean') throw new Error('invalid_visibility');
        values.push(body.activity_visible);
        updates.push(`activity_visible=$${values.length}`);
      }
      updates.push('updated_at=NOW()');
      const result = await pool.query<MemberRow>(`UPDATE leaderboard_members SET ${updates.join(',')} WHERE id=$${values.length + 1} RETURNING id,nickname,avatar_file,role,activity_visible`, [...values, member.id]);
      boardCache.clear();
      return memberJson(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return fail(reply, 409, 'nickname_taken', 'Nickname is already in use');
      if (['invalid_nickname', 'invalid_role', 'invalid_visibility'].includes(error?.message)) return fail(reply, 400, error.message, 'Nickname, role, or visibility is invalid');
      throw error;
    }
  });

  app.put('/api/v1/stats', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['days'], properties: { days: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['date', 'keyboard', 'mouse'], properties: { date: { type: 'string' }, keyboard: { type: 'integer', minimum: 0 }, mouse: { type: 'integer', minimum: 0 } } } } } } }
  }, async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    if (limiter.isLimited(`stats:${member.id}`, 30, 10 * 60_000)) return fail(reply, 429, 'rate_limited', 'Statistics are syncing too frequently');
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
      boardCache.clear();
      return { ok: true, synced: days.length };
    } catch (error: any) {
      if (error?.message === 'invalid_stats') return fail(reply, 400, 'invalid_stats', 'Statistics payload is invalid');
      throw error;
    }
  });

  app.get('/api/v1/leaderboard', {
    schema: { querystring: { type: 'object', additionalProperties: false, required: ['period'], properties: { period: { type: 'string', enum: ['today', 'week'] }, page: { type: 'integer', minimum: 1, default: 1 } } } }
  }, async (request, reply) => {
    if (limiter.isLimited(`board:${request.ip}`, 120, 60_000)) return fail(reply, 429, 'rate_limited', 'Leaderboard is refreshing too frequently');
    const period = (request.query as { period: 'today' | 'week' }).period;
    const requestedPage = (request.query as { page?: number }).page ?? 1;
    let selfId: string | undefined;
    if (request.headers.authorization) {
      const member = await authenticate(request, reply); if (!member) return;
      selfId = member.id;
    }
    const pageSize = 20;
    const cached = boardCache.get(period);
    let starts_on = ''; let ends_on = '';
    let base: Array<{ rank: number; member_id: string; nickname: string; role: string; avatar: ReturnType<typeof avatar>; keyboard: number; mouse: number; total: number }> = [];
    if (cached && cached.expires > Date.now()) {
      ({ starts_on, ends_on, entries: base } = cached);
    } else {
      const bounds = periodBounds(period);
      starts_on = bounds.start; ends_on = bounds.end;
      const result = await pool.query<MemberRow & { keyboard: string; mouse: string }>(`SELECT m.id,m.nickname,m.avatar_file,m.role,COALESCE(SUM(s.keyboard),0)::text keyboard,COALESCE(SUM(s.mouse),0)::text mouse FROM leaderboard_members m JOIN leaderboard_daily_stats s ON s.member_id=m.id AND s.day BETWEEN $1 AND $2 GROUP BY m.id,m.nickname,m.avatar_file,m.role,m.created_at HAVING SUM(s.keyboard+s.mouse)>0 ORDER BY SUM(s.keyboard+s.mouse) DESC,m.created_at ASC,m.id ASC`, [bounds.start, bounds.end]);
      base = result.rows.map((row, index) => ({ rank: index + 1, member_id: row.id, nickname: row.nickname, role: row.role, avatar: avatar(row), keyboard: Number(row.keyboard), mouse: Number(row.mouse), total: Number(row.keyboard) + Number(row.mouse) }));
      boardCache.set(period, { expires: Date.now() + boardCacheMs, starts_on, ends_on, entries: base });
    }
    const totalEntries = base.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const slice = base.slice((page - 1) * pageSize, page * pageSize);
    const entries = slice.map(entry => ({ ...entry, is_self: entry.member_id === selfId }));
    const self = selfId ? base.find(entry => entry.member_id === selfId) : undefined;
    const selfRank = self?.rank ?? null;
    const selfEntry = self ? { ...self, is_self: true } : null;
    return { period, starts_on, ends_on, entries, page, page_size: pageSize, total_entries: totalEntries, total_pages: totalPages, self_rank: selfRank, self_entry: selfEntry };
  });

  app.get('/api/v1/members/:memberId/activity', {
    schema: { params: { type: 'object', additionalProperties: false, required: ['memberId'], properties: { memberId: { type: 'string', pattern: '^[0-9a-f-]{36}$' } } }, querystring: { type: 'object', additionalProperties: false, properties: { days: { type: 'integer', minimum: 1, maximum: 90, default: 30 } } } }
  }, async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    const { memberId } = request.params as { memberId: string };
    const days = (request.query as { days?: number }).days ?? 30;
    let displayMember: MemberRow = member;
    if (memberId !== member.id) {
      const target = await pool.query<MemberRow>('SELECT id,nickname,avatar_file,role,activity_visible FROM leaderboard_members WHERE id=$1', [memberId]);
      if (!target.rows[0]) return fail(reply, 404, 'not_found', 'Member not found');
      if (!target.rows[0].activity_visible) return fail(reply, 403, 'activity_private', 'This member has not made their activity public');
      displayMember = target.rows[0];
    }
    if (limiter.isLimited(`activity:${member.id}`, 60, 60_000)) return fail(reply, 429, 'rate_limited', 'Activity is being viewed too frequently');
    const range = activityRange(days);
    const rows = await pool.query<{ day: string; keyboard: string; mouse: string }>('SELECT day::text AS day, keyboard, mouse FROM leaderboard_daily_stats WHERE member_id=$1 AND day BETWEEN $2 AND $3 ORDER BY day ASC', [memberId, range.start, range.end]);
    return { member: memberJson(displayMember), start_day: range.start, end_day: range.end, days: rows.rows.map(row => ({ day: row.day, keyboard: Number(row.keyboard), mouse: Number(row.mouse), total: Number(row.keyboard) + Number(row.mouse) })) };
  });

  app.get('/api/v1/avatar/:memberId', async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    if (!/^[0-9a-f-]{36}$/.test(memberId)) return fail(reply, 404, 'not_found', 'Avatar not found');
    const result = await pool.query<{ avatar_file: string | null }>('SELECT avatar_file FROM leaderboard_members WHERE id=$1', [memberId]);
    const file = result.rows[0]?.avatar_file;
    if (!file) return fail(reply, 404, 'not_found', 'Avatar not found');
    const path = avatarFilePath(file);
    if (!path) return fail(reply, 404, 'not_found', 'Avatar not found');
    try {
      const bytes = await readFile(path);
      return reply.header('Cache-Control', 'public, max-age=300').type('image/webp').send(bytes);
    } catch { return fail(reply, 404, 'not_found', 'Avatar not found'); }
  });

  app.post('/api/v1/avatar', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    if (limiter.isLimited(`avatar:${member.id}`, 10, 60 * 60_000)) return fail(reply, 429, 'rate_limited', 'Avatar is changing too frequently');
    let staged: string | undefined;
    try {
      const bytes = assertWebp(request.body);
      await mkdir(avatarRoot, { recursive: true });
      const file = `${randomUUID()}.webp`;
      staged = join(avatarRoot, `.${file}.tmp`);
      await writeFile(staged, bytes, { flag: 'wx', mode: 0o600 });
      const published = join(avatarRoot, file);
      await rename(staged, published);
      staged = undefined;
      try {
        await pool.query('UPDATE leaderboard_members SET avatar_file=$1,updated_at=NOW() WHERE id=$2', [file, member.id]);
      } catch (error) {
        await removeAvatarFile(request, file, 'rollback_new_avatar');
        throw error;
      }
      await removeAvatarFile(request, member.avatar_file, 'replace_avatar');
      boardCache.clear();
      return memberJson({ ...member, avatar_file: file });
    } catch (error: any) {
      if (staged) await removePath(request, staged, 'rollback_staged_avatar');
      if (error?.message === 'invalid_avatar') return fail(reply, 400, 'invalid_avatar', 'Avatar must be a static WebP image up to 1024×1024 and 200 KB');
      throw error;
    }
  });

  app.delete('/api/v1/avatar', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    await pool.query('UPDATE leaderboard_members SET avatar_file=NULL,updated_at=NOW() WHERE id=$1', [member.id]);
    await removeAvatarFile(request, member.avatar_file, 'delete_avatar');
    boardCache.clear();
    return { ok: true };
  });

  app.delete('/api/v1/me', async (request, reply) => {
    const member = await authenticate(request, reply); if (!member) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleted = await client.query<{ invitation_id: string | null }>('DELETE FROM leaderboard_members WHERE id=$1 RETURNING invitation_id', [member.id]);
      const invitationId = deleted.rows[0]?.invitation_id;
      if (invitationId) await client.query('UPDATE leaderboard_invitations SET uses=GREATEST(0,uses-1) WHERE id=$1', [invitationId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    await removeAvatarFile(request, member.avatar_file, 'delete_account');
    boardCache.clear();
    return { ok: true };
  });

  app.setErrorHandler((error, _request, reply) => {
    if ((error as any).validation) return fail(reply, 400, 'invalid_request', 'Request payload is invalid');
    app.log.error(error);
    return fail(reply, 500, 'internal_error', 'The leaderboard is temporarily unavailable');
  });
  return app;
}
