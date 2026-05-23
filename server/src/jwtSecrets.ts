// Persistent JWT secrets module.
// Strategy:
//  1) If JWT_*_SECRET env vars are set, use them (preferred).
//  2) Otherwise, load from system_config table in the DB.
//  3) If not in DB, generate once and store. This survives Vercel cold starts.
import crypto from 'crypto';
import { query } from './db/pool';

let cachedAccessSecret: string | null = null;
let cachedRefreshSecret: string | null = null;

async function loadOrCreateDbSecret(key: string): Promise<string> {
  const existing = await query<{ value: string }>(
    'SELECT value FROM system_config WHERE key = $1',
    [key],
  );
  if (existing.rows.length > 0) return existing.rows[0].value;

  const newSecret = crypto.randomBytes(48).toString('hex');
  await query(
    `INSERT INTO system_config (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING`,
    [key, newSecret],
  );
  // Re-read to handle concurrent-startup race
  const reread = await query<{ value: string }>(
    'SELECT value FROM system_config WHERE key = $1',
    [key],
  );
  return reread.rows[0].value;
}

export async function initJwtSecrets(): Promise<void> {
  const envAccess = process.env['JWT_ACCESS_SECRET'];
  const envRefresh = process.env['JWT_REFRESH_SECRET'];

  cachedAccessSecret = envAccess && envAccess.length >= 16
    ? envAccess
    : await loadOrCreateDbSecret('jwt_access_secret');

  cachedRefreshSecret = envRefresh && envRefresh.length >= 16
    ? envRefresh
    : await loadOrCreateDbSecret('jwt_refresh_secret');
}

export function getJwtAccessSecret(): string {
  if (!cachedAccessSecret) {
    throw new Error('JWT secrets not initialized — ensureInitialized() must complete first');
  }
  return cachedAccessSecret;
}

export function getJwtRefreshSecret(): string {
  if (!cachedRefreshSecret) {
    throw new Error('JWT secrets not initialized — ensureInitialized() must complete first');
  }
  return cachedRefreshSecret;
}
