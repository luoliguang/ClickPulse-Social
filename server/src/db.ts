import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 });

export async function migrate(): Promise<void> {
  const candidates = [join(process.cwd(), 'schema.sql'), join(process.cwd(), 'src', 'schema.sql')];
  let schema: string | undefined;
  for (const path of candidates) {
    try { schema = await readFile(path, 'utf8'); break; } catch { /* try the next explicit location */ }
  }
  if (!schema) throw new Error('schema.sql not found');
  await pool.query(schema);
}
