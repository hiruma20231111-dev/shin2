import pool from './pool';
import { MIGRATION_SQL } from './schema';
import { initJwtSecrets } from '../jwtSecrets';

let initPromise: Promise<void> | null = null;

export function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await pool.query(MIGRATION_SQL);
        console.log('[db] Schema ready.');
        await initJwtSecrets();
        console.log('[db] JWT secrets loaded.');
      } catch (err) {
        initPromise = null; // allow retry on next request
        console.error('[db] Initialization error:', err);
        throw err;
      }
    })();
  }
  return initPromise;
}
