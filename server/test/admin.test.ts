import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdminSession, createPasswordHash, generateInviteCode, verifyAdminSession, verifyPassword } from '../src/admin';
import { buildApp } from '../src/app';

test('admin passwords use bounded scrypt hashes and constant-shape verification', () => {
  const encoded = createPasswordHash('correct horse battery staple');
  assert.match(encoded, /^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.equal(verifyPassword('correct horse battery staple', encoded), true);
  assert.equal(verifyPassword('wrong password', encoded), false);
  assert.equal(verifyPassword('anything', 'broken'), false);
});

test('admin sessions expire and cannot be verified with a different secret', () => {
  const now = Date.UTC(2026, 10, 16);
  const session = createAdminSession('secret-a', now);
  assert.equal(verifyAdminSession(session, 'secret-a', now + 1000), true);
  assert.equal(verifyAdminSession(session, 'secret-b', now + 1000), false);
  assert.equal(verifyAdminSession(session, 'secret-a', now + 9 * 60 * 60 * 1000), false);
});

test('generated invitation codes match the client format and do not repeat', () => {
  const codes = new Set(Array.from({ length: 100 }, generateInviteCode));
  assert.equal(codes.size, 100);
  for (const code of codes) assert.match(code, /^CP-[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){3}$/);
});

test('admin UI is unavailable until a password hash is configured', async () => {
  const previous = process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_PASSWORD_HASH;
  const app = buildApp();
  const response = await app.inject({ method: 'GET', url: '/admin' });
  assert.equal(response.statusCode, 404);
  await app.close();
  if (previous === undefined) delete process.env.ADMIN_PASSWORD_HASH; else process.env.ADMIN_PASSWORD_HASH = previous;
});

test('admin login rejects cross-origin requests and issues a hardened cookie on success', async () => {
  const previous = process.env.ADMIN_PASSWORD_HASH;
  process.env.ADMIN_PASSWORD_HASH = createPasswordHash('correct horse battery staple');
  const app = buildApp();
  const page = await app.inject({ method: 'GET', url: '/admin' });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /当前加入人数/);
  assert.match(page.body, /邀请码台账/);
  const script = await app.inject({ method: 'GET', url: '/admin/app.js' });
  assert.equal(script.statusCode, 200);
  assert.doesNotMatch(script.body, /\bconfirm\s*\(/);
  const rejected = await app.inject({ method: 'POST', url: '/admin/api/session', headers: { origin: 'https://evil.example' }, payload: { password: 'correct horse battery staple' } });
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.json().error.code, 'invalid_origin');
  const accepted = await app.inject({ method: 'POST', url: '/admin/api/session', headers: { origin: 'https://clickpulse.fangdutex.cn' }, payload: { password: 'correct horse battery staple' } });
  assert.equal(accepted.statusCode, 200);
  assert.match(String(accepted.headers['set-cookie']), /clickpulse_admin=.+; Path=\/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=28800/);
  await app.close();
  if (previous === undefined) delete process.env.ADMIN_PASSWORD_HASH; else process.env.ADMIN_PASSWORD_HASH = previous;
});

test('update mirror serves only allowlisted versioned release assets from the private root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'clickpulse-updates-'));
  const previous = process.env.UPDATE_ROOT;
  process.env.UPDATE_ROOT = root;
  await writeFile(join(root, 'latest.json'), JSON.stringify({ tag_name: 'v1.2.3' }));
  await mkdir(join(root, 'v1.2.3'));
  await writeFile(join(root, 'v1.2.3', 'ClickPulse-1.2.3-windows-x64.zip'), 'verified fixture');
  await writeFile(join(root, 'v1.2.3', 'ClickPulse-1.2.3-macos-arm64.dmg'), 'verified dmg');
  const app = buildApp();
  const metadata = await app.inject({ method: 'GET', url: '/api/v1/updates/latest' });
  assert.equal(metadata.statusCode, 200);
  assert.equal(metadata.json().tag_name, 'v1.2.3');
  assert.equal(metadata.headers['cache-control'], 'no-store');
  const asset = await app.inject({ method: 'GET', url: '/api/v1/updates/download/1.2.3/ClickPulse-1.2.3-windows-x64.zip' });
  assert.equal(asset.statusCode, 200);
  assert.equal(asset.body, 'verified fixture');
  assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');
  const installer = await app.inject({ method: 'GET', url: '/api/v1/updates/download/1.2.3/ClickPulse-1.2.3-macos-arm64.dmg' });
  assert.equal(installer.statusCode, 200);
  assert.equal(installer.body, 'verified dmg');
  const rejected = await app.inject({ method: 'GET', url: '/api/v1/updates/download/1.2.3/package.zip' });
  assert.equal(rejected.statusCode, 404);
  await app.close();
  await rm(root, { recursive: true, force: true });
  if (previous === undefined) delete process.env.UPDATE_ROOT; else process.env.UPDATE_ROOT = previous;
});
