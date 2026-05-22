// ============================================================
// Hub Workspace — Project Templates Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AppError } from '../errors';
import { API_ERROR_CODES } from '../constants';
import type { ProjectTemplate, TemplateTask } from '../types';

const router = Router();
router.use(authenticate);

const templateTaskSchema = z.object({
  title: z.string().min(1),
  tool_identifier: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  duration_days: z.number().int().positive().default(1),
  order_index: z.number().int().default(0),
});

const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  industry: z.string().default('汎用'),
  description: z.string().optional(),
  tasks: z.array(templateTaskSchema).default([]),
});

const templateUpdateSchema = z.object({
  name: z.string().optional(),
  industry: z.string().optional(),
  description: z.string().optional(),
  tasks: z.array(templateTaskSchema).optional(),
});

// ── GET / — list templates with tasks ─────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await query<ProjectTemplate>(
      `SELECT * FROM project_templates ORDER BY is_system DESC, name`,
    );
    const tasks = await query<TemplateTask>(
      `SELECT * FROM template_tasks ORDER BY template_id, order_index`,
    );
    const map = new Map<string, TemplateTask[]>();
    for (const t of tasks.rows) {
      const arr = map.get(t.template_id) ?? [];
      arr.push(t);
      map.set(t.template_id, arr);
    }
    const data = templates.rows.map((tpl) => ({ ...tpl, tasks: map.get(tpl.id) ?? [] }));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id ──────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await query<ProjectTemplate>(
      `SELECT * FROM project_templates WHERE id = $1`,
      [req.params['id']],
    );
    if (tpl.rows.length === 0) {
      throw new AppError('テンプレートが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    const tasks = await query<TemplateTask>(
      `SELECT * FROM template_tasks WHERE template_id = $1 ORDER BY order_index`,
      [req.params['id']],
    );
    res.json({ success: true, data: { ...tpl.rows[0], tasks: tasks.rows } });
  } catch (e) {
    next(e);
  }
});

// ── POST / ────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = templateSchema.parse(req.body);
    const tpl = await query<ProjectTemplate>(
      `INSERT INTO project_templates (id, name, industry, description, is_system)
       VALUES ($1, $2, $3, $4, false) RETURNING *`,
      [body.id, body.name, body.industry, body.description ?? ''],
    );
    for (const t of body.tasks) {
      await query(
        `INSERT INTO template_tasks (id, template_id, title, tool_identifier, priority, duration_days, order_index)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)`,
        [body.id, t.title, t.tool_identifier ?? null, t.priority, t.duration_days, t.order_index],
      );
    }
    res.status(201).json({ success: true, data: { ...tpl.rows[0], tasks: body.tasks } });
  } catch (e) {
    next(e);
  }
});

// ── PUT /:id ──────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    const body = templateUpdateSchema.parse(req.body);

    const existing = await query<ProjectTemplate>(
      `SELECT * FROM project_templates WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      throw new AppError('テンプレートが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    if (existing.rows[0].is_system) {
      throw new AppError('システムテンプレートは編集できません', API_ERROR_CODES.FORBIDDEN, 403);
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const k of ['name', 'industry', 'description'] as const) {
      if (body[k] !== undefined) {
        sets.push(`${k} = $${i++}`);
        params.push(body[k]);
      }
    }
    if (sets.length > 0) {
      sets.push('updated_at = now()');
      params.push(id);
      await query(
        `UPDATE project_templates SET ${sets.join(', ')} WHERE id = $${i}`,
        params,
      );
    }

    if (body.tasks) {
      await query(`DELETE FROM template_tasks WHERE template_id = $1`, [id]);
      for (const t of body.tasks) {
        await query(
          `INSERT INTO template_tasks (id, template_id, title, tool_identifier, priority, duration_days, order_index)
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)`,
          [id, t.title, t.tool_identifier ?? null, t.priority, t.duration_days, t.order_index],
        );
      }
    }

    const updated = await query<ProjectTemplate>(`SELECT * FROM project_templates WHERE id = $1`, [id]);
    const tasks = await query<TemplateTask>(
      `SELECT * FROM template_tasks WHERE template_id = $1 ORDER BY order_index`,
      [id],
    );
    res.json({ success: true, data: { ...updated.rows[0], tasks: tasks.rows } });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /:id ───────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await query<ProjectTemplate>(
      `SELECT is_system FROM project_templates WHERE id = $1`,
      [req.params['id']],
    );
    if (existing.rows.length === 0) {
      throw new AppError('テンプレートが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    if (existing.rows[0].is_system) {
      throw new AppError('システムテンプレートは削除できません', API_ERROR_CODES.FORBIDDEN, 403);
    }
    await query(`DELETE FROM project_templates WHERE id = $1`, [req.params['id']]);
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── POST /from-project — save existing project as template ────
const fromProjectSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1),
});

router.post('/from-project', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = fromProjectSchema.parse(req.body);
    const project = await query<{ name: string; client_id: string }>(
      `SELECT name, client_id FROM projects WHERE id = $1`,
      [body.project_id],
    );
    if (project.rows.length === 0) {
      throw new AppError('プロジェクトが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    const tasks = await query<{
      title: string;
      assigned_tool: string | null;
      priority: string;
      start_date: string | null;
      due_date: string | null;
      order_index: number;
    }>(
      `SELECT title, assigned_tool, priority, start_date, due_date, order_index
       FROM tasks WHERE project_id = $1 ORDER BY order_index`,
      [body.project_id],
    );

    // Generate template id: tpl_<slug>_<timestamp>
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24);
    const templateId = `tpl_${slug}_${Date.now()}`;

    await query(
      `INSERT INTO project_templates (id, name, industry, description, is_system)
       VALUES ($1, $2, '汎用', '', false)`,
      [templateId, body.name],
    );

    for (const t of tasks.rows) {
      let durationDays = 1;
      if (t.start_date && t.due_date) {
        const diff = (new Date(t.due_date).getTime() - new Date(t.start_date).getTime()) / 86_400_000;
        durationDays = Math.max(1, Math.round(diff));
      }
      await query(
        `INSERT INTO template_tasks (id, template_id, title, tool_identifier, priority, duration_days, order_index)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)`,
        [templateId, t.title, t.assigned_tool, t.priority, durationDays, t.order_index],
      );
    }

    const tpl = await query<ProjectTemplate>(`SELECT * FROM project_templates WHERE id = $1`, [templateId]);
    res.status(201).json({ success: true, data: tpl.rows[0] });
  } catch (e) {
    next(e);
  }
});

export default router;
