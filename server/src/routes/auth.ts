// ============================================================
// Hub Workspace — Authentication Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../db/pool';
import { AppError } from '../errors';
import { authenticate } from '../middleware/auth';
import {
  API_ERROR_CODES,
  JWT_ACCESS_EXPIRES_IN_SEC,
  JWT_REFRESH_EXPIRES_IN_SEC,
} from '../constants';
import type { JwtPayload } from '../types';

const router = Router();

const REFRESH_COOKIE_NAME = 'refresh_token';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  is_active: boolean;
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(payload: JwtPayload): string {
  const secret = process.env['JWT_ACCESS_SECRET'];
  if (!secret) throw new AppError('JWT_ACCESS_SECRET 未設定', API_ERROR_CODES.INTERNAL_ERROR, 500);
  const opts: SignOptions = { expiresIn: JWT_ACCESS_EXPIRES_IN_SEC };
  return jwt.sign(payload, secret, opts);
}

function signRefreshToken(payload: JwtPayload): string {
  const secret = process.env['JWT_REFRESH_SECRET'];
  if (!secret) throw new AppError('JWT_REFRESH_SECRET 未設定', API_ERROR_CODES.INTERNAL_ERROR, 500);
  const opts: SignOptions = { expiresIn: JWT_REFRESH_EXPIRES_IN_SEC };
  return jwt.sign(payload, secret, opts);
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: JWT_REFRESH_EXPIRES_IN_SEC * 1000,
    path: '/api/auth',
  });
}

// ── POST /login ───────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const result = await query<UserRow>(
      `SELECT id, email, password_hash, name, role, is_active
       FROM users WHERE email = $1 LIMIT 1`,
      [body.email],
    );

    if (result.rows.length === 0) {
      throw new AppError('メールアドレスまたはパスワードが正しくありません', API_ERROR_CODES.UNAUTHORIZED, 401);
    }

    const user = result.rows[0];
    if (!user.is_active) {
      throw new AppError('アカウントが無効化されています', API_ERROR_CODES.FORBIDDEN, 403);
    }

    const ok = await bcrypt.compare(body.password, user.password_hash);
    if (!ok) {
      throw new AppError('メールアドレスまたはパスワードが正しくありません', API_ERROR_CODES.UNAUTHORIZED, 401);
    }

    const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store hashed refresh token
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRES_IN_SEC * 1000);
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES (uuid_generate_v4(), $1, $2, $3)`,
      [user.id, tokenHash, expiresAt.toISOString()],
    );

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /logout ──────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (token) {
      const tokenHash = hashRefreshToken(token);
      await query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
        [tokenHash],
      );
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

// ── POST /refresh ─────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!token) {
      throw new AppError('リフレッシュトークンがありません', API_ERROR_CODES.UNAUTHORIZED, 401);
    }

    const secret = process.env['JWT_REFRESH_SECRET'];
    if (!secret) throw new AppError('JWT_REFRESH_SECRET 未設定', API_ERROR_CODES.INTERNAL_ERROR, 500);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, secret) as JwtPayload;
    } catch {
      throw new AppError('リフレッシュトークンが無効です', API_ERROR_CODES.UNAUTHORIZED, 401);
    }

    const tokenHash = hashRefreshToken(token);
    const dbToken = await query<{ id: string; revoked_at: string | null; expires_at: string }>(
      `SELECT id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
      [tokenHash],
    );

    if (dbToken.rows.length === 0) {
      throw new AppError('リフレッシュトークンが見つかりません', API_ERROR_CODES.UNAUTHORIZED, 401);
    }
    const row = dbToken.rows[0];
    if (row.revoked_at) {
      throw new AppError('リフレッシュトークンが取り消されています', API_ERROR_CODES.UNAUTHORIZED, 401);
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new AppError('リフレッシュトークンの有効期限が切れています', API_ERROR_CODES.UNAUTHORIZED, 401);
    }

    const accessToken = signAccessToken({ userId: payload.userId, email: payload.email, role: payload.role });
    res.json({ success: true, data: { accessToken } });
  } catch (e) {
    next(e);
  }
});

// ── GET /me — return current user from access token ──────────
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<{ id: string; email: string; name: string; role: string; is_active: boolean }>(
      `SELECT id, email, name, role, is_active FROM users WHERE id = $1`,
      [req.user!.userId],
    );
    if (result.rows.length === 0) {
      throw new AppError('ユーザーが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    const u = result.rows[0];
    if (!u.is_active) {
      throw new AppError('アカウントが無効化されています', API_ERROR_CODES.FORBIDDEN, 403);
    }
    res.json({ success: true, data: u });
  } catch (e) {
    next(e);
  }
});

export default router;
