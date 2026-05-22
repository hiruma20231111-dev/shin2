// ============================================================
// Hub Workspace — Global Error Handler Middleware
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../errors';
import { API_ERROR_CODES } from '../constants';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isDev = process.env['NODE_ENV'] === 'development';

  // ── AppError ──────────────────────────────────────────────
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        ...(isDev ? { stack: err.stack } : {}),
      },
    });
    return;
  }

  // ── ZodError ──────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.errors.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    res.status(400).json({
      success: false,
      error: {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: '入力データが無効です',
        details,
        ...(isDev ? { stack: err.stack } : {}),
      },
    });
    return;
  }

  // ── Unknown / generic ─────────────────────────────────────
  if (err instanceof Error) {
    console.error('[errorHandler]', err);
    res.status(500).json({
      success: false,
      error: {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: '内部サーバーエラーが発生しました',
        ...(isDev ? { details: err.message, stack: err.stack } : {}),
      },
    });
    return;
  }

  console.error('[errorHandler] Unknown error type:', err);
  res.status(500).json({
    success: false,
    error: {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: '内部サーバーエラーが発生しました',
    },
  });
}
