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

// ── GET /kpi — KPI metrics ────────────────────────────────────
router.get('/kpi', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Monthly revenue for past 6 months
    const revenueHistory = await query<{ month: string; revenue: string; paid: string }>(
      `SELECT
         to_char(date_trunc('month', issue_date), 'YYYY-MM') AS month,
         COALESCE(SUM(amount), 0)::text AS revenue,
         COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::text AS paid
       FROM invoices
       WHERE issue_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
       GROUP BY date_trunc('month', issue_date)
       ORDER BY date_trunc('month', issue_date) ASC`,
    );

    // Task velocity: completed tasks per week for past 4 weeks
    const taskVelocity = await query<{ week: string; completed: string; created: string }>(
      `SELECT
         to_char(date_trunc('week', updated_at), 'YYYY-MM-DD') AS week,
         COUNT(*) FILTER (WHERE status = 'done')::text AS completed,
         COUNT(*)::text AS created
       FROM tasks
       WHERE updated_at >= NOW() - INTERVAL '4 weeks'
       GROUP BY date_trunc('week', updated_at)
       ORDER BY date_trunc('week', updated_at) ASC`,
    );

    // Project status breakdown
    const projectBreakdown = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM projects GROUP BY status`,
    );

    // Task priority breakdown
    const taskBreakdown = await query<{ priority: string; count: string; done: string }>(
      `SELECT
         priority,
         COUNT(*)::text AS count,
         COUNT(*) FILTER (WHERE status = 'done')::text AS done
       FROM tasks GROUP BY priority`,
    );

    // Tool utilization — tasks assigned to each tool
    const toolUtilization = await query<{ tool: string; total: string; done: string }>(
      `SELECT
         assigned_tool AS tool,
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status = 'done')::text AS done
       FROM tasks
       WHERE assigned_tool IS NOT NULL
       GROUP BY assigned_tool
       ORDER BY total DESC`,
    );

    res.json({
      success: true,
      data: {
        revenueHistory: revenueHistory.rows.map((r) => ({
          month: r.month,
          revenue: parseFloat(r.revenue),
          paid: parseFloat(r.paid),
        })),
        taskVelocity: taskVelocity.rows.map((r) => ({
          week: r.week,
          completed: parseInt(r.completed, 10),
          created: parseInt(r.created, 10),
        })),
        projectBreakdown: projectBreakdown.rows.map((r) => ({
          status: r.status,
          count: parseInt(r.count, 10),
        })),
        taskBreakdown: taskBreakdown.rows.map((r) => ({
          priority: r.priority,
          count: parseInt(r.count, 10),
          done: parseInt(r.done, 10),
        })),
        toolUtilization: toolUtilization.rows.map((r) => ({
          tool: r.tool,
          total: parseInt(r.total, 10),
          done: parseInt(r.done, 10),
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

// ── GET /resources — resource planning view ───────────────────
router.get('/resources', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await query<{
      id: string; title: string; status: string; priority: string;
      assigned_tool: string | null; start_date: string | null; due_date: string | null;
      project_id: string; project_name: string; client_name: string;
    }>(
      `SELECT t.id, t.title, t.status, t.priority, t.assigned_tool,
              t.start_date, t.due_date,
              p.id AS project_id, p.name AS project_name, c.name AS client_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN clients c ON c.id = p.client_id
       WHERE t.status <> 'done'
         AND (t.due_date IS NOT NULL OR t.start_date IS NOT NULL)
       ORDER BY COALESCE(t.due_date, t.start_date) ASC
       LIMIT 200`,
    );

    res.json({ success: true, data: tasks.rows });
  } catch (e) {
    next(e);
  }
});

export default router;
