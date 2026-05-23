// ============================================================
// Hub Workspace — PostgreSQL Connection Pool
// ============================================================
import { Pool, QueryResult, QueryResultRow } from 'pg';

if (!process.env['DATABASE_URL']) {
  console.warn('[pool] DATABASE_URL is not set. Database calls will fail.');
}

// Neon and other cloud PostgreSQL providers require SSL.
// Enable SSL whenever DATABASE_URL is set and is not a local connection.
const dbUrl = process.env['DATABASE_URL'] ?? '';
const isLocalDb =
  dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('::1');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl && !isLocalDb ? { rejectUnauthorized: false } : false,
  max: 5, // keep low for serverless
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[pool] Unexpected error on idle client:', err);
});

export default pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}
