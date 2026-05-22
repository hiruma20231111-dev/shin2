// ============================================================
// Hub Workspace — Workflows (multi-tool task chains)
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AppError, NotImplementedError } from '../errors';
import { API_ERROR_CODES } from '../constants';
import type { Workflow, WorkflowStep } from '../types';

const router = Router();
router.use(authenticate);

const stepSchema = z.object({
  task_id: z.string().uuid(),
  step_order: z.number().int(),
  tool_identifier: z.string().optional().nullable(),
});

const workflowSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(''),
  steps: z.array(stepSchema).default([]),
});

// ── GET /project/:projectId ───────────────────────────────────
router.get('/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<Workflow>(
      `SELECT * FROM workflows WHERE project_id = $1 ORDER BY created_at DESC`,
      [req.params['projectId']],
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id — workflow with steps ────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wf = await query<Workflow>(`SELECT * FROM workflows WHERE id = $1`, [req.params['id']]);
    if (wf.rows.length === 0) {
      throw new AppError('ワークフローが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    const steps = await query<WorkflowStep>(
      `SELECT * FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order`,
      [req.params['id']],
    );
    res.json({ success: true, data: { ...wf.rows[0], steps: steps.rows } });
  } catch (e) {
    next(e);
  }
});

// ── POST / ────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = workflowSchema.parse(req.body);
    const wf = await query<Workflow>(
      `INSERT INTO workflows (id, project_id, name, description, status)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'draft') RETURNING *`,
      [body.project_id, body.name, body.description],
    );
    for (const s of body.steps) {
      await query(
        `INSERT INTO workflow_steps (id, workflow_id, task_id, step_order, tool_identifier, status)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, 'pending')`,
        [wf.rows[0].id, s.task_id, s.step_order, s.tool_identifier ?? null],
      );
    }
    res.status(201).json({ success: true, data: wf.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /:id/steps/:stepId — update step status ─────────────
const stepStatusSchema = z.object({
  status: z.enum(['pending', 'active', 'completed', 'skipped', 'error']),
});

router.patch('/:id/steps/:stepId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = stepStatusSchema.parse(req.body);
    const result = await query<WorkflowStep>(
      `UPDATE workflow_steps SET status = $1 WHERE id = $2 RETURNING *`,
      [body.status, req.params['stepId']],
    );
    if (result.rows.length === 0) {
      throw new AppError('ステップが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── POST /:id/execute — auto-execute chain ────────────────────
router.post('/:id/execute', async (_req: Request, _res: Response, next: NextFunction) => {
  // TODO(hub): [将来実装] ワークフロー自動実行エンジン
  //  - 各stepの順序通りにbuildAndSendPacketを呼び出し、結果を次stepの入力に伝播
  //  - 失敗step以降の処理停止と再開のロジック
  next(new NotImplementedError('ワークフローの自動実行はまだ実装されていません'));
});

export default router;
