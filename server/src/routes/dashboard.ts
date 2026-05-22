// ============================================================
// Hub Workspace — Dashboard Aggregation Route
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import type { Task, ActivityLog } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // ── 今週のタスク (期限が今日から7日以内、未完了) ──
    const thisWeek = await query<Task>(
      `SELECT * FROM tasks
       WHERE status <> 'done'
         AND due_date IS NOT NULL
         AND due_date >= CURRENT_DATE
         AND due_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY due_date ASC,
         CASE priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END
       LIMIT 50`,
    );

    // ── 進行中プロジェクト数 ──
    const activeCount = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM projects WHERE status IN ('planning', 'active', 'review')`,
    );

    // ── 完了率 ──
    const completion = await query<{ total: string; done: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status = 'completed')::text AS done
       FROM projects`,
    );
    const total = parseInt(completion.rows[0].total, 10);
    const done = parseInt(completion.rows[0].done, 10);
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    // ── 今月売上 ──
    const revenue = await query<{ total: string; invoiced: string; uninvoiced: string }>(
      `SELECT
         COALESCE(SUM(amount), 0)::text AS total,
         COALESCE(SUM(amount) FILTER (WHERE status IN ('sent', 'paid')), 0)::text AS invoiced,
         COALESCE(SUM(amount) FILTER (WHERE status = 'draft'), 0)::text AS uninvoiced
       FROM invoices
       WHERE issue_date >= date_trunc('month', CURRENT_DATE)
         AND issue_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`,
    );

    // ── ツール稼働状況 ──
    const toolStatuses = await query<{
      identifier: string;
      name: string;
      status: 'online' | 'offline' | 'degraded';
      last_health_check: string | null;
    }>(
      `SELECT identifier, name, status, last_health_check
       FROM tools WHERE is_active = true ORDER BY name`,
    );

    // ── 最近のアクティビティ ──
    const activity = await query<ActivityLog>(
      `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 20`,
    );

    res.json({
      success: true,
      data: {
        thisWeekTasks: thisWeek.rows,
        activeProjectsCount: parseInt(activeCount.rows[0].count, 10),
        projectCompletionRate: rate,
        monthlyRevenue: {
          total: parseFloat(revenue.rows[0].total),
          invoiced: parseFloat(revenue.rows[0].invoiced),
          uninvoiced: parseFloat(revenue.rows[0].uninvoiced),
        },
        toolStatuses: toolStatuses.rows,
        recentActivity: activity.rows,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
