// ============================================================
// Hub Workspace — PostgreSQL Connection Pool
// ============================================================
import { Pool, QueryResult, QueryResultRow } from 'pg';

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
 * Convenience query helper with optional row-type generic.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}
