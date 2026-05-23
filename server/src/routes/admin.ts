// ============================================================
// Hub Workspace — Admin Bootstrap Routes
// First-run bootstrap: POST /api/admin/bootstrap creates the first
// admin user. Blocked once any user exists in the DB.
// GET /api/admin/status returns system health (open, no auth).
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool';
import { AppError } from '../errors';
import { API_ERROR_CODES, BCRYPT_ROUNDS } from '../constants';

const router = Router();

const bootstrapSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'パスワードは8文字以上必要です'),
  name: z.string().min(1).default('管理者'),
});

// POST /api/admin/bootstrap
// Creates the first admin user. Returns 409 if users already exist.
router.post('/bootstrap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const countResult = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    const userCount = parseInt(countResult.rows[0]?.count ?? '0', 10);

    if (userCount > 0) {
      return next(
        new AppError(
          'システムは既に初期化済みです',
          API_ERROR_CODES.FORBIDDEN,
          409,
        ),
      );
    }

    const { email, password, name } = bootstrapSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await query<{ id: string; email: string; role: string }>(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, role`,
      [email, passwordHash, name],
    );

    res.status(201).json({ success: true, data: { user: result.rows[0] } });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/status
// Returns whether the system has been initialized and DB is reachable.
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
    const userCount = parseInt(result.rows[0]?.count ?? '0', 10);
    res.json({
      success: true,
      data: {
        initialized: userCount > 0,
        userCount,
        dbConnected: true,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
