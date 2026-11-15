import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { pool } from './db';
import { hashSecret } from './domain';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const maxUses = Number(process.argv[2] || 1);
const days = Number(process.argv[3] || 30);
if (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 1000 || !Number.isSafeInteger(days) || days < 1 || days > 365) throw new Error('Usage: npm run invite -- <max-uses 1..1000> <valid-days 1..365>');
const code = `CP_${randomBytes(12).toString('base64url')}`;
pool.query("INSERT INTO leaderboard_invitations(id,code_hash,max_uses,expires_at) VALUES($1,$2,$3,NOW()+($4||' days')::interval)", [randomUUID(), hashSecret(code), maxUses, String(days)])
  .then(() => console.log(code))
  .finally(() => pool.end());
