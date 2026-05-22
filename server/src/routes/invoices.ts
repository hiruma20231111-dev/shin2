// ============================================================
// Hub Workspace — Invoices Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AppError } from '../errors';
import { API_ERROR_CODES } from '../constants';
import { logActivity } from '../services/activityLogger';
import type { Invoice } from '../types';

const router = Router();
router.use(authenticate);

const invoiceSchema = z.object({
  client_id: z.string().uuid(),
  project_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  amount: z.number().nonnegative(),
  tax_rate: z.number().min(0).max(100).default(10),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).default('draft'),
  issue_date: z.string(),
  due_date: z.string(),
  paid_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  external_invoice_id: z.string().optional().nullable(),
});

const invoiceUpdateSchema = invoiceSchema.partial();

// ── GET / ─────────────────────────────────────────────────────
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
      `SELECT COUNT(*)::text AS count FROM invoices ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, limit, offset];
    const result = await query<Invoice>(
      `SELECT * FROM invoices ${whereClause}
       ORDER BY issue_date DESC LIMIT $${i++} OFFSET $${i}`,
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
    const result = await query<Invoice>(`SELECT * FROM invoices WHERE id = $1`, [req.params['id']]);
    if (result.rows.length === 0) {
      throw new AppError('請求書が見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── POST / ────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = invoiceSchema.parse(req.body);
    const result = await query<Invoice>(
      `INSERT INTO invoices
        (id, client_id, project_id, title, amount, tax_rate, status, issue_date, due_date, paid_date, notes, external_invoice_id)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        body.client_id,
        body.project_id ?? null,
        body.title,
        body.amount,
        body.tax_rate,
        body.status,
        body.issue_date,
        body.due_date,
        body.paid_date ?? null,
        body.notes ?? null,
        body.external_invoice_id ?? null,
      ],
    );
    await logActivity({
      userId: req.user!.userId,
      action: 'invoice.created',
      entityType: 'invoice',
      entityId: result.rows[0].id,
      clientId: body.client_id,
    });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── PUT /:id ──────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = invoiceUpdateSchema.parse(req.body);
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
    const result = await query<Invoice>(
      `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new AppError('請求書が見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// ── DELETE /:id ───────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(`DELETE FROM invoices WHERE id = $1`, [req.params['id']]);
    if (result.rowCount === 0) {
      throw new AppError('請求書が見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── PATCH /:id/status ─────────────────────────────────────────
const statusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
});

router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = statusSchema.parse(req.body);
    const paidDate = body.status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
    const result = await query<Invoice>(
      `UPDATE invoices
       SET status = $1,
           paid_date = COALESCE($2, paid_date),
           updated_at = now()
       WHERE id = $3 RETURNING *`,
      [body.status, paidDate, req.params['id']],
    );
    if (result.rows.length === 0) {
      throw new AppError('請求書が見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

export default router;
