import { createHash } from 'node:crypto';

export const MAX_DAILY_COUNT = 5_000_000;
export const MAX_AVATAR_BYTES = 200 * 1024;

export function hashSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
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
  if (!Buffer.isBuffer(body) || body.length < 12 || body.length > MAX_AVATAR_BYTES || body.subarray(0, 4).toString() !== 'RIFF' || body.subarray(8, 12).toString() !== 'WEBP') throw new Error('invalid_avatar');
  return body;
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

const COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#c2410c', '#be123c', '#0369a1'];
export function defaultAvatar(memberId: string, nickname: string) {
  const digest = createHash('sha256').update(memberId).digest();
  return { url: null as string | null, initial: [...nickname][0]?.toUpperCase() || '?', color: COLORS[digest[0] % COLORS.length] };
}
