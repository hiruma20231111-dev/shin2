// ============================================================
// Hub Workspace — Database Migration Runner
// ============================================================
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './pool';

async function migrate(): Promise<void> {
  const sql = readFileSync(join(__dirname, 'migrations', '001_initial.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Migration complete');
  await pool.end();
}

migrate().catch((e) => {
  console.error('[migrate] Error:', e);
  process.exit(1);
});
