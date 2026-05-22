// ============================================================
// Hub Workspace — Activity Log Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import type { ActivityLog } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10)));
    const offset = (page - 1) * limit;

    const filters: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (req.query['entity_type']) {
      filters.push(`entity_type = $${i++}`);
      params.push(req.query['entity_type']);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM activity_logs ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, limit, offset];
    const result = await query<ActivityLog>(
      `SELECT * FROM activity_logs ${whereClause}
       ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
      listParams,
    );
    res.json({ success: true, data: result.rows, total, page, limit });
  } catch (e) {
    next(e);
  }
});

export default router;
