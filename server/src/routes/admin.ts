// ============================================================
// Hub Workspace — Admin Bootstrap Routes
// One-time admin user initialization for production environments.
// Protected by ADMIN_INIT_TOKEN environment variable.
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool';
import { AppError } from '../errors';
import { API_ERROR_CODES, BCRYPT_ROUNDS } from '../constants';

const router = Router();

function requireInitToken(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env['ADMIN_INIT_TOKEN'];
  if (!expected || expected.length < 16) {
    return next(
      new AppError(
        'ADMIN_INIT_TOKEN 未設定 (16文字以上必須)',
        API_ERROR_CODES.INTERNAL_ERROR,
        500,
      ),
    );
  }
  const provided = req.header('x-init-token');
  if (!provided || provided !== expected) {
    return next(new AppError('初期化トークンが不正です', API_ERROR_CODES.UNAUTHORIZED, 401));
  }
  next();
}

const upsertAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).default('管理者'),
});

router.post(
  '/init-admin',
  requireInitToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, name } = upsertAdminSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await query<{ id: string; email: string; role: string }>(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               name = EXCLUDED.name,
               role = 'admin',
               is_active = true
         RETURNING id, email, role`,
        [email, passwordHash, name],
      );
      res.json({ success: true, data: { user: result.rows[0] } });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/status',
  requireInitToken,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await query<{ email: string; role: string; is_active: boolean }>(
        `SELECT email, role, is_active FROM users ORDER BY created_at ASC`,
      );
      res.json({
        success: true,
        data: {
          userCount: users.rowCount ?? 0,
          users: users.rows,
        },
      });
    } catch (e) {
      next(e);
    }
  },
);

export default router;
