// ============================================================
// Hub Workspace — Clients & Client DNA Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AppError } from '../errors';
import { API_ERROR_CODES } from '../constants';
import { logActivity } from '../services/activityLogger';
import type { Client, ClientDNA, ActivityLog } from '../types';

const router = Router();
router.use(authenticate);

const clientSchema = z.object({
  name: z.string().min(1, '名前は必須です'),
  industry: z.string().min(1, '業種は必須です'),
  status: z.enum(['active', 'inactive', 'paused']).default('active'),
  tags: z.array(z.string()).default([]),
  contact_email: z.string().email().optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const clientUpdateSchema = clientSchema.partial();

const dnaSchema = z.object({
  category: z.string().min(1, 'カテゴリは必須です'),
  content: z.string().min(1, '内容は必須です'),
});

// ── GET / — list clients (paginated, filtered) ────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10)));
    const offset = (page - 1) * limit;

    const filters: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (req.query['status']) {
      filters.push(`status = $${i++}`);
      params.push(req.query['status']);
    }
    if (req.query['industry']) {
      filters.push(`industry = $${i++}`);
      params.push(req.query['industry']);
    }
    if (req.query['tag']) {
      filters.push(`$${i++} = ANY(tags)`);
      params.push(req.query['tag']);
    }
    if (req.query['search']) {
      filters.push(`(name ILIKE $${i} OR industry ILIKE $${i})`);
      params.push(`%${req.query['search']}%`);
      i++;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM clients ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, limit, offset];
    const result = await query<Client>(
      `SELECT * FROM clients ${whereClause}
       ORDER BY updated_at DESC LIMIT $${i++} OFFSET $${i}`,
      listParams,
    );

    res.json({ success: true, data: result.rows, total, page, limit });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id — get client detail ──────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<Client>(`SELECT * FROM clients WHERE id = $1`, [req.params['id']]);
    if (result.rows.length === 0) {
      throw new AppError('クライアントが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── POST / — create ───────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = clientSchema.parse(req.body);
    const result = await query<Client>(
      `INSERT INTO clients (id, name, industry, status, tags, contact_email, contact_phone, notes)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [body.name, body.industry, body.status, body.tags, body.contact_email ?? null, body.contact_phone ?? null, body.notes ?? null],
    );
    const created = result.rows[0];
    await logActivity({
      userId: req.user!.userId,
      action: 'client.created',
      entityType: 'client',
      entityId: created.id,
      clientId: created.id,
      changes: { name: body.name },
    });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
});

// ── PUT /:id — update ─────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = clientUpdateSchema.parse(req.body);
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
    sets.push(`updated_at = now()`);
    params.push(id);
    const result = await query<Client>(
      `UPDATE clients SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new AppError('クライアントが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    await logActivity({
      userId: req.user!.userId,
      action: 'client.updated',
      entityType: 'client',
      entityId: id!,
      clientId: id!,
      changes: body,
    });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /:id ────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id'];
    const result = await query(`DELETE FROM clients WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      throw new AppError('クライアントが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    await logActivity({
      userId: req.user!.userId,
      action: 'client.deleted',
      entityType: 'client',
      entityId: id!,
    });
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id/dna ──────────────────────────────────────────────
router.get('/:id/dna', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<ClientDNA>(
      `SELECT * FROM client_dna WHERE client_id = $1 ORDER BY created_at`,
      [req.params['id']],
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    next(e);
  }
});

// ── POST /:id/dna ─────────────────────────────────────────────
router.post('/:id/dna', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = dnaSchema.parse(req.body);
    const id = req.params['id'];
    const result = await query<ClientDNA>(
      `INSERT INTO client_dna (id, client_id, category, content)
       VALUES (uuid_generate_v4(), $1, $2, $3) RETURNING *`,
      [id, body.category, body.content],
    );
    await logActivity({
      userId: req.user!.userId,
      action: 'client_dna.created',
      entityType: 'client_dna',
      entityId: result.rows[0].id,
      clientId: id!,
    });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── PUT /:id/dna/:dnaId ───────────────────────────────────────
router.put('/:id/dna/:dnaId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = dnaSchema.partial().parse(req.body);
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
    params.push(req.params['dnaId']);
    const result = await query<ClientDNA>(
      `UPDATE client_dna SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new AppError('DNA項目が見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /:id/dna/:dnaId ────────────────────────────────────
router.delete('/:id/dna/:dnaId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`DELETE FROM client_dna WHERE id = $1`, [req.params['dnaId']]);
    if (result.rowCount === 0) {
      throw new AppError('DNA項目が見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── GET /:id/activity ─────────────────────────────────────────
router.get('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<ActivityLog>(
      `SELECT * FROM activity_logs WHERE client_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.params['id']],
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    next(e);
  }
});

export default router;
