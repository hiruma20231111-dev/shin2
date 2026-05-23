import { describe, it, expect } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from '../middleware/errorHandler';
import { AppError } from '../errors';
import { API_ERROR_CODES } from '../constants';

function makeApp(thrower: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.get('/test', thrower);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('returns 401 with UNAUTHORIZED code for AppError', async () => {
    const app = makeApp((_req, _res, next) => {
      next(new AppError('not allowed', API_ERROR_CODES.UNAUTHORIZED, 401));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('not allowed');
  });

  it('returns 404 for NOT_FOUND AppError', async () => {
    const app = makeApp((_req, _res, next) => {
      next(new AppError('not found', API_ERROR_CODES.NOT_FOUND, 404));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 with VALIDATION_ERROR for ZodError', async () => {
    const schema = z.object({ name: z.string().min(1), age: z.number() });
    const app = makeApp((_req, _res, next) => {
      try {
        schema.parse({ name: '', age: 'bad' });
      } catch (e) {
        next(e);
      }
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(res.body.error.details[0]).toHaveProperty('path');
    expect(res.body.error.details[0]).toHaveProperty('message');
  });

  it('returns 500 for generic Error', async () => {
    const app = makeApp((_req, _res, next) => {
      next(new Error('something went wrong'));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 for unknown thrown value', async () => {
    const app = makeApp((_req, _res, next) => {
      next('raw string error');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('includes stack trace in development mode', async () => {
    process.env['NODE_ENV'] = 'development';
    const app = makeApp((_req, _res, next) => {
      next(new AppError('dev error', API_ERROR_CODES.INTERNAL_ERROR, 500));
    });
    const res = await request(app).get('/test');
    expect(res.body.error.stack).toBeDefined();
    process.env['NODE_ENV'] = 'test';
  });

  it('omits stack trace when NODE_ENV is not development', async () => {
    process.env['NODE_ENV'] = 'production';
    const app = makeApp((_req, _res, next) => {
      next(new AppError('prod error', API_ERROR_CODES.INTERNAL_ERROR, 500));
    });
    const res = await request(app).get('/test');
    expect(res.body.error.stack).toBeUndefined();
    process.env['NODE_ENV'] = 'test';
  });

  it('includes details in AppError when provided', async () => {
    const app = makeApp((_req, _res, next) => {
      next(new AppError('conflict', API_ERROR_CODES.DUPLICATE_ENTRY, 409, { field: 'email' }));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ field: 'email' });
  });
});
