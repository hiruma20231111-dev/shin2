import pool from './pool';
import { MIGRATION_SQL } from './schema';

let initPromise: Promise<void> | null = null;

export function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = pool
      .query(MIGRATION_SQL)
      .then(() => {
        console.log('[db] Schema ready.');
      })
      .catch((err) => {
        initPromise = null; // allow retry on next request
        console.error('[db] Migration error:', err);
        throw err;
      });
  }
  return initPromise;
}
