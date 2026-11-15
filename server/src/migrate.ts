import 'dotenv/config';
import { migrate, pool } from './db';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
migrate().then(() => console.log('Leaderboard schema is up to date')).finally(() => pool.end());
