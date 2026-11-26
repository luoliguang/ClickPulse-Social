import { createHash, randomBytes } from 'node:crypto';

export const MAX_DAILY_COUNT = 5_000_000;
export const MAX_AVATAR_BYTES = 200 * 1024;
export const MAX_AVATAR_DIMENSION = 1024;

export function hashSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => 'RC_' + randomBytes(16).toString('base64url'));
}

export function assertRecoveryCode(value: unknown): string {
  if (typeof value !== 'string') throw new Error('invalid_recovery_code');
  const code = value.trim();
  if (!/^RC_[A-Za-z0-9_-]{20,}$/.test(code)) throw new Error('invalid_recovery_code');
  return code;
}

export const ROLES = ['developer', 'designer', 'product_manager', 'operations', 'marketing', 'data', 'engineer', 'researcher', 'teacher', 'writer', 'student', 'office', 'finance', 'sales', 'hr', 'customer_support', 'legal', 'medical', 'freelancer', 'other'] as const;

export function normalizeRole(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'other';
  if (typeof value !== 'string') throw new Error('invalid_role');
  const role = value.trim() || 'other';
  if (!(ROLES as readonly string[]).includes(role)) throw new Error('invalid_role');
  return role;
}

export function normalizeNickname(value: unknown): { nickname: string; key: string } {
  if (typeof value !== 'string') throw new Error('invalid_nickname');
  const nickname = value.trim().replace(/\s+/g, ' ');
  const length = [...nickname].length;
  if (length < 1 || length > 24 || /[\u0000-\u001f\u007f<>]/u.test(nickname)) throw new Error('invalid_nickname');
  return { nickname, key: nickname.toLocaleLowerCase('zh-CN') };
}

export function assertInvite(value: unknown): string {
  if (typeof value !== 'string') throw new Error('invalid_invite');
  const code = value.trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) throw new Error('invalid_invite');
  return code;
}

export function assertWebp(body: unknown): Buffer {
  const invalid = (): never => { throw new Error('invalid_avatar'); };
  if (!Buffer.isBuffer(body)) invalid();
  const bytes = body as Buffer;
  if (bytes.length < 26 || bytes.length > MAX_AVATAR_BYTES || bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') invalid();
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) invalid();

  let offset = 12;
  let imageSize: { width: number; height: number } | undefined;
  let canvasSize: { width: number; height: number } | undefined;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) invalid();
    const type = bytes.subarray(offset, offset + 4).toString();
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkSize;
    if (end > bytes.length) invalid();
    const chunk = bytes.subarray(start, end);

    if (type === 'VP8 ') {
      if (imageSize || chunk.length < 10 || chunk[3] !== 0x9d || chunk[4] !== 0x01 || chunk[5] !== 0x2a) invalid();
      imageSize = { width: chunk.readUInt16LE(6) & 0x3fff, height: chunk.readUInt16LE(8) & 0x3fff };
    } else if (type === 'VP8L') {
      if (imageSize || chunk.length < 5 || chunk[0] !== 0x2f) invalid();
      imageSize = {
        width: 1 + chunk[1] + ((chunk[2] & 0x3f) << 8),
        height: 1 + (chunk[2] >> 6) + (chunk[3] << 2) + ((chunk[4] & 0x0f) << 10)
      };
    } else if (type === 'VP8X') {
      if (offset !== 12 || canvasSize || chunk.length !== 10 || (chunk[0] & 0xc3) !== 0 || chunk[1] !== 0 || chunk[2] !== 0 || chunk[3] !== 0) invalid();
      canvasSize = {
        width: 1 + chunk.readUIntLE(4, 3),
        height: 1 + chunk.readUIntLE(7, 3)
      };
      if (canvasSize.width > MAX_AVATAR_DIMENSION || canvasSize.height > MAX_AVATAR_DIMENSION || canvasSize.width * canvasSize.height > MAX_AVATAR_DIMENSION * MAX_AVATAR_DIMENSION) invalid();
    }
    offset = end + (chunkSize & 1);
  }

  if (offset !== bytes.length || !imageSize) invalid();
  const frameSize = imageSize as { width: number; height: number };
  if (frameSize.width < 1 || frameSize.height < 1 || frameSize.width > MAX_AVATAR_DIMENSION || frameSize.height > MAX_AVATAR_DIMENSION || frameSize.width * frameSize.height > MAX_AVATAR_DIMENSION * MAX_AVATAR_DIMENSION) invalid();
  if (canvasSize && (canvasSize.width !== frameSize.width || canvasSize.height !== frameSize.height)) invalid();
  return bytes;
}

export type DailyInput = { date: string; keyboard: number; mouse: number };
export function normalizeDays(value: unknown, allowedDates: Set<string>): DailyInput[] {
  if (!Array.isArray(value) || value.length > 8) throw new Error('invalid_stats');
  const seen = new Set<string>();
  return value.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('invalid_stats');
    const keys = Object.keys(row).sort().join(',');
    if (keys !== 'date,keyboard,mouse') throw new Error('invalid_stats');
    const { date, keyboard, mouse } = row as Record<string, unknown>;
    if (typeof date !== 'string' || !allowedDates.has(date) || seen.has(date)) throw new Error('invalid_stats');
    if (!Number.isSafeInteger(keyboard) || !Number.isSafeInteger(mouse) || (keyboard as number) < 0 || (mouse as number) < 0 || (keyboard as number) > MAX_DAILY_COUNT || (mouse as number) > MAX_DAILY_COUNT) throw new Error('invalid_stats');
    seen.add(date);
    return { date, keyboard: keyboard as number, mouse: mouse as number };
  });
}

export function shanghaiDate(offsetDays = 0, now = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted);
}

export function allowedUploadDates(now = new Date()): Set<string> {
  return new Set(Array.from({ length: 8 }, (_, index) => shanghaiDate(-index, now)));
}

export function periodBounds(period: 'today' | 'week', now = new Date()): { start: string; end: string } {
  const today = shanghaiDate(0, now);
  if (period === 'today') return { start: today, end: today };
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(now);
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const mondayOffset = -((index + 6) % 7);
  return { start: shanghaiDate(mondayOffset, now), end: shanghaiDate(mondayOffset + 6, now) };
}

export function activityRange(days: number, now = new Date()): { start: string; end: string } {
  const count = Math.max(1, Math.min(90, Math.trunc(days)));
  return { start: shanghaiDate(-(count - 1), now), end: shanghaiDate(0, now) };
}

const COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#c2410c', '#be123c', '#0369a1'];
export function defaultAvatar(memberId: string, nickname: string) {
  const digest = createHash('sha256').update(memberId).digest();
  return { url: null as string | null, initial: [...nickname][0]?.toUpperCase() || '?', color: COLORS[digest[0] % COLORS.length] };
}
