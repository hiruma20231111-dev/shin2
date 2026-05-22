// ============================================================
// Hub Workspace — Tool Registry Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AppError } from '../errors';
import { API_ERROR_CODES, TOOL_STATUS } from '../constants';
import { logActivity } from '../services/activityLogger';
import type { Tool } from '../types';

const router = Router();
router.use(authenticate);

const toolSchema = z.object({
  identifier: z.string().min(1).regex(/^[a-z0-9_]+$/, 'identifier は半角英数字とアンダースコアのみ'),
  name: z.string().min(1),
  description: z.string().default(''),
  endpoint_url: z.string().url('endpoint_url はURLである必要があります'),
  health_endpoint: z.string().url('health_endpoint はURLである必要があります'),
  capabilities: z.record(z.unknown()).default({}),
  is_active: z.boolean().default(true),
});

const toolUpdateSchema = toolSchema.partial();

// ── GET / ─────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<Tool>(`SELECT * FROM tools ORDER BY name`);
    res.json({ success: true, data: result.rows });
  } catch (e) {
    next(e);
  }
});

// ── POST / ────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = toolSchema.parse(req.body);
    const result = await query<Tool>(
      `INSERT INTO tools (id, identifier, name, description, endpoint_url, health_endpoint, capabilities, is_active)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        body.identifier,
        body.name,
        body.description,
        body.endpoint_url,
        body.health_endpoint,
        JSON.stringify(body.capabilities),
        body.is_active,
      ],
    );
    await logActivity({
      userId: req.user!.userId,
      action: 'tool.registered',
      entityType: 'tool',
      entityId: result.rows[0].id,
    });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    if (e instanceof Error && /unique/i.test(e.message)) {
      next(new AppError('同じ identifier のツールが既に登録されています', API_ERROR_CODES.DUPLICATE_ENTRY, 409));
      return;
    }
    next(e);
  }
});

// ── PUT /:id ──────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = toolUpdateSchema.parse(req.body);
    const id = req.params['id'];
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(body)) {
      sets.push(`${k} = $${i++}`);
      params.push(k === 'capabilities' ? JSON.stringify(v) : v);
    }
    if (sets.length === 0) {
      throw new AppError('更新するフィールドがありません', API_ERROR_CODES.VALIDATION_ERROR, 400);
    }
    sets.push('updated_at = now()');
    params.push(id);
    const result = await query<Tool>(
      `UPDATE tools SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new AppError('ツールが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /:id — deactivate (soft delete) ────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    const result = await query(
      `UPDATE tools SET is_active = false, updated_at = now() WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      throw new AppError('ツールが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── POST /:id/health — immediate health check ─────────────────
router.post('/:id/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    const row = await query<{ id: string; health_endpoint: string }>(
      `SELECT id, health_endpoint FROM tools WHERE id = $1`,
      [id],
    );
    if (row.rows.length === 0) {
      throw new AppError('ツールが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    let status: string;
    try {
      const resp = await fetch(row.rows[0].health_endpoint, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
        status = body['status'] === 'degraded' ? TOOL_STATUS.DEGRADED : TOOL_STATUS.ONLINE;
      } else {
        status = TOOL_STATUS.DEGRADED;
      }
    } catch {
      status = TOOL_STATUS.OFFLINE;
    }
    await query(
      `UPDATE tools SET status = $1, last_health_check = now() WHERE id = $2`,
      [status, id],
    );
    res.json({ success: true, data: { status, checked_at: new Date().toISOString() } });
  } catch (e) {
    next(e);
  }
});

export default router;
