// Shared JWT secrets module.
// If env vars are set, use them (sessions survive cold starts).
// Otherwise, use ephemeral per-process secrets (sessions lost on cold start).
import crypto from 'crypto';

const _ephemeralAccess = crypto.randomBytes(32).toString('hex');
const _ephemeralRefresh = crypto.randomBytes(32).toString('hex');

export function getJwtAccessSecret(): string {
  const v = process.env['JWT_ACCESS_SECRET'];
  if (!v) console.warn('[auth] JWT_ACCESS_SECRET not set — using ephemeral secret.');
  return v ?? _ephemeralAccess;
}

export function getJwtRefreshSecret(): string {
  const v = process.env['JWT_REFRESH_SECRET'];
  if (!v) console.warn('[auth] JWT_REFRESH_SECRET not set — using ephemeral secret.');
  return v ?? _ephemeralRefresh;
}
