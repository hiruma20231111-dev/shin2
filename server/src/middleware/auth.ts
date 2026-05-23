// ============================================================
// Hub Workspace — JWT Authentication Middleware
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors';
import { API_ERROR_CODES } from '../constants';
import { getJwtAccessSecret } from '../jwtSecrets';
import type { JwtPayload } from '../types';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError(
        '認証トークンが必要です',
        API_ERROR_CODES.UNAUTHORIZED,
        401
      )
    );
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, getJwtAccessSecret()) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(
        new AppError(
          '認証トークンの有効期限が切れています',
          API_ERROR_CODES.UNAUTHORIZED,
          401
        )
      );
    }
    return next(
      new AppError(
        '認証トークンが無効です',
        API_ERROR_CODES.UNAUTHORIZED,
        401
      )
    );
  }
}
