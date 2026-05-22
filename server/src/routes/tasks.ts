// ============================================================
// Hub Workspace — Tasks & Tool Execution Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AppError } from '../errors';
import { API_ERROR_CODES, TASK_STATUS } from '../constants';
import { logActivity } from '../services/activityLogger';
import { buildAndSendPacket, receivePacketResult } from '../services/toolContextPacket';
import type { Task, ToolContextPacketRecord } from '../types';

const router = Router();
router.use(authenticate);

const taskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().default(''),
  status: z.enum([TASK_STATUS.TODO, TASK_STATUS.IN_PROGRESS, TASK_STATUS.REVIEW, TASK_STATUS.DONE]).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assigned_tool: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  order_index: z.number().int().default(0),
});

const taskUpdateSchema = taskSchema.partial();

// ── GET /:id ──────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<Task>(`SELECT * FROM tasks WHERE id = $1`, [req.params['id']]);
    if (result.rows.length === 0) {
      throw new AppError('タスクが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── POST / ────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = taskSchema.parse(req.body);
    const result = await query<Task>(
      `INSERT INTO tasks
        (id, project_id, title, description, status, priority, assigned_tool, start_date, due_date, order_index)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        body.project_id,
        body.title,
        body.description,
        body.status,
        body.priority,
        body.assigned_tool ?? null,
        body.start_date ?? null,
        body.due_date ?? null,
        body.order_index,
      ],
    );
    const created = result.rows[0];
    await logActivity({
      userId: req.user!.userId,
      action: 'task.created',
      entityType: 'task',
      entityId: created.id,
      projectId: created.project_id,
      taskId: created.id,
    });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

// ── PUT /:id ──────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = taskUpdateSchema.parse(req.body);
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
    const result = await query<Task>(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new AppError('タスクが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    await logActivity({
      userId: req.user!.userId,
      action: 'task.updated',
      entityType: 'task',
      entityId: id!,
      taskId: id!,
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
    const result = await query(`DELETE FROM tasks WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      throw new AppError('タスクが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    await logActivity({
      userId: req.user!.userId,
      action: 'task.deleted',
      entityType: 'task',
      entityId: id!,
    });
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── POST /:id/execute — send ToolContextPacket ────────────────
router.post('/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const { packetId } = await buildAndSendPacket(id, req.user!.userId);
    const packet = await query<ToolContextPacketRecord>(
      `SELECT * FROM tool_context_packets WHERE id = $1`,
      [packetId],
    );
    await logActivity({
      userId: req.user!.userId,
      action: 'task.executed',
      entityType: 'task',
      entityId: id,
      taskId: id,
      changes: { packetId },
    });
    res.json({ success: true, data: packet.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id/packets ──────────────────────────────────────────
router.get('/:id/packets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<ToolContextPacketRecord>(
      `SELECT * FROM tool_context_packets WHERE task_id = $1 ORDER BY created_at DESC`,
      [req.params['id']],
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    next(e);
  }
});

// ── POST /:id/packets/:packetId/result ────────────────────────
const resultSchema = z.object({ result: z.record(z.unknown()) });

router.post('/:id/packets/:packetId/result', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = resultSchema.parse(req.body);
    await receivePacketResult(req.params['packetId']!, body.result);
    const packet = await query<ToolContextPacketRecord>(
      `SELECT * FROM tool_context_packets WHERE id = $1`,
      [req.params['packetId']],
    );
    res.json({ success: true, data: packet.rows[0] });
  } catch (e) {
    next(e);
  }
});

export default router;
