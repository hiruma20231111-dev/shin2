// ============================================================
// Hub Workspace — PostgreSQL Connection Pool
// ============================================================
import { Pool, QueryResult } from 'pg';

if (!process.env['DATABASE_URL']) {
  console.warn('[pool] DATABASE_URL is not set. Database calls will fail.');
}

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[pool] Unexpected error on idle client:', err);
});

export default pool;

/**
 * Convenience query helper that uses the default pool.
 */
export async function query(
  text: string,
  params?: unknown[]
): Promise<QueryResult> {
  return pool.query(text, params as unknown[]);
}
