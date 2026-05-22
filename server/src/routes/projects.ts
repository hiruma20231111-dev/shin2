// ============================================================
// Hub Workspace — Projects, Kanban, Gantt, Dependencies
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AppError } from '../errors';
import { API_ERROR_CODES, TASK_STATUS } from '../constants';
import { logActivity } from '../services/activityLogger';
import type { Project, Task, TaskDependency } from '../types';

const router = Router();
router.use(authenticate);

const projectSchema = z.object({
  client_id: z.string().uuid('client_id はUUIDである必要があります'),
  name: z.string().min(1),
  description: z.string().default(''),
  status: z.enum(['planning', 'active', 'review', 'completed', 'cancelled']).default('planning'),
  template_id: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
});

const projectUpdateSchema = projectSchema.partial();

// ── GET / — list projects ─────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10)));
    const offset = (page - 1) * limit;

    const filters: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (req.query['client_id']) {
      filters.push(`client_id = $${i++}`);
      params.push(req.query['client_id']);
    }
    if (req.query['status']) {
      filters.push(`status = $${i++}`);
      params.push(req.query['status']);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM projects ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, limit, offset];
    const result = await query<Project>(
      `SELECT * FROM projects ${whereClause}
       ORDER BY updated_at DESC LIMIT $${i++} OFFSET $${i}`,
      listParams,
    );
    res.json({ success: true, data: result.rows, total, page, limit });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id ──────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<Project>(`SELECT * FROM projects WHERE id = $1`, [req.params['id']]);
    if (result.rows.length === 0) {
      throw new AppError('プロジェクトが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── POST / — create (optionally from template) ────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = projectSchema.parse(req.body);

    // Insert project
    const insertResult = await query<Project>(
      `INSERT INTO projects (id, client_id, name, description, status, template_id, start_date, end_date)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        body.client_id,
        body.name,
        body.description,
        body.status,
        body.template_id ?? null,
        body.start_date ?? null,
        body.end_date ?? null,
      ],
    );
    const project = insertResult.rows[0];

    // If template provided, generate tasks from template_tasks
    if (body.template_id) {
      const templateTasks = await query<{
        title: string;
        tool_identifier: string | null;
        priority: string;
        duration_days: number;
        order_index: number;
      }>(
        `SELECT title, tool_identifier, priority, duration_days, order_index
         FROM template_tasks WHERE template_id = $1 ORDER BY order_index`,
        [body.template_id],
      );

      // Compute start dates by chaining durations from project's start_date
      let cursor = body.start_date ? new Date(body.start_date) : new Date();
      for (const tt of templateTasks.rows) {
        const start = new Date(cursor);
        const due = new Date(cursor);
        due.setDate(due.getDate() + tt.duration_days);
        await query(
          `INSERT INTO tasks (id, project_id, title, status, priority, assigned_tool, start_date, due_date, order_index)
           VALUES (uuid_generate_v4(), $1, $2, 'todo', $3, $4, $5, $6, $7)`,
          [
            project.id,
            tt.title,
            tt.priority,
            tt.tool_identifier,
            start.toISOString().slice(0, 10),
            due.toISOString().slice(0, 10),
            tt.order_index,
          ],
        );
        cursor = due;
      }
    }

    await logActivity({
      userId: req.user!.userId,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      clientId: project.client_id,
      projectId: project.id,
    });
    res.status(201).json({ success: true, data: project });
  } catch (e) {
    next(e);
  }
});

// ── PUT /:id ──────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = projectUpdateSchema.parse(req.body);
    const id = req.params['id'];
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(body)) {
      sets.push(`${k} = $${i++}`);
      params.push(v);
    }
    if (sets.length === 0) {
      throw new AppError('更新するフィールドがありません', API_ERROR_CODES.VALIDATION_ERROR, 400);
    }
    sets.push('updated_at = now()');
    params.push(id);
    const result = await query<Project>(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new AppError('プロジェクトが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    await logActivity({
      userId: req.user!.userId,
      action: 'project.updated',
      entityType: 'project',
      entityId: id!,
      projectId: id!,
      changes: body,
    });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /:id ───────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    const result = await query(`DELETE FROM projects WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      throw new AppError('プロジェクトが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    await logActivity({
      userId: req.user!.userId,
      action: 'project.deleted',
      entityType: 'project',
      entityId: id!,
    });
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id/kanban ───────────────────────────────────────────
router.get('/:id/kanban', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await query<Task>(
      `SELECT * FROM tasks WHERE project_id = $1 ORDER BY status, order_index`,
      [req.params['id']],
    );
    const grouped = { todo: [] as Task[], in_progress: [] as Task[], review: [] as Task[], done: [] as Task[] };
    for (const t of tasks.rows) {
      const key = t.status as keyof typeof grouped;
      grouped[key].push(t);
    }
    res.json({ success: true, data: grouped });
  } catch (e) {
    next(e);
  }
});

// ── PUT /:id/kanban ───────────────────────────────────────────
const kanbanUpdateSchema = z.object({
  updates: z.array(
    z.object({
      taskId: z.string().uuid(),
      status: z.enum([TASK_STATUS.TODO, TASK_STATUS.IN_PROGRESS, TASK_STATUS.REVIEW, TASK_STATUS.DONE]),
    }),
  ),
});

router.put('/:id/kanban', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = kanbanUpdateSchema.parse(req.body);
    for (const u of body.updates) {
      await query(`UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2`, [u.status, u.taskId]);
    }
    await logActivity({
      userId: req.user!.userId,
      action: 'kanban.bulk_update',
      entityType: 'project',
      entityId: req.params['id']!,
      projectId: req.params['id']!,
      changes: { count: body.updates.length },
    });
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id/gantt ────────────────────────────────────────────
router.get('/:id/gantt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params['id'];
    const tasks = await query<Task>(
      `SELECT * FROM tasks WHERE project_id = $1 ORDER BY order_index`,
      [projectId],
    );
    const deps = await query<{ task_id: string; depends_on_task_id: string }>(
      `SELECT td.task_id, td.depends_on_task_id
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       WHERE t.project_id = $1`,
      [projectId],
    );
    const depMap = new Map<string, string[]>();
    for (const d of deps.rows) {
      const arr = depMap.get(d.task_id) ?? [];
      arr.push(d.depends_on_task_id);
      depMap.set(d.task_id, arr);
    }
    const data = tasks.rows.map((t) => ({ ...t, dependencies: depMap.get(t.id) ?? [] }));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// ── PUT /:projectId/gantt/:taskId — update task dates ─────────
const ganttTaskSchema = z.object({
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  order_index: z.number().int().optional(),
});

router.put('/:projectId/gantt/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ganttTaskSchema.parse(req.body);
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(body)) {
      sets.push(`${k} = $${i++}`);
      params.push(v);
    }
    if (sets.length === 0) {
      throw new AppError('更新するフィールドがありません', API_ERROR_CODES.VALIDATION_ERROR, 400);
    }
    sets.push('updated_at = now()');
    params.push(req.params['taskId']);
    const result = await query<Task>(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new AppError('タスクが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── POST /:projectId/dependencies ─────────────────────────────
const dependencySchema = z.object({
  task_id: z.string().uuid(),
  depends_on_task_id: z.string().uuid(),
});

router.post('/:projectId/dependencies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = dependencySchema.parse(req.body);
    if (body.task_id === body.depends_on_task_id) {
      throw new AppError('自身を依存先にすることはできません', API_ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const result = await query<TaskDependency>(
      `INSERT INTO task_dependencies (id, task_id, depends_on_task_id)
       VALUES (uuid_generate_v4(), $1, $2)
       ON CONFLICT (task_id, depends_on_task_id) DO NOTHING
       RETURNING *`,
      [body.task_id, body.depends_on_task_id],
    );
    if (result.rows.length === 0) {
      throw new AppError('依存関係は既に存在します', API_ERROR_CODES.DUPLICATE_ENTRY, 409);
    }
    res.status(201).json({ success: true, data: { id: result.rows[0].id } });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /:projectId/dependencies/:dependencyId ─────────────
router.delete('/:projectId/dependencies/:dependencyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `DELETE FROM task_dependencies WHERE id = $1`,
      [req.params['dependencyId']],
    );
    if (result.rowCount === 0) {
      throw new AppError('依存関係が見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

export default router;
