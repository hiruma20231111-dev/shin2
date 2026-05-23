import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import pool from '../db/pool';
import app from '../app';

const ADMIN_EMAIL = 'hiruma20231111@gmail.com';
const ADMIN_PASS = 'shin0510';

let accessToken: string;
let refreshCookie: string;

beforeAll(async () => {
  // Ensure admin exists (seed may not have run in test DB)
  // Just attempt login; if it fails the login tests will catch it
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/auth/login', () => {
  it('returns 200 with accessToken and sets refresh cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
    expect(res.body.data.user.role).toBe('admin');
    expect(res.headers['set-cookie']).toBeDefined();

    const cookieHeader = res.headers['set-cookie'] as string[];
    const rtCookie = cookieHeader.find((c: string) => c.startsWith('refresh_token='));
    expect(rtCookie).toBeDefined();
    expect(rtCookie).toContain('HttpOnly');
    expect(rtCookie).toContain('Path=/api/auth');

    accessToken = res.body.data.accessToken;
    refreshCookie = rtCookie!.split(';')[0];
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'SomePass123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'pass' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when password is empty', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns new accessToken when valid refresh cookie is present', async () => {
    // Login first to get cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });
    const cookieHeader = loginRes.headers['set-cookie'] as string[];
    const rtCookie = cookieHeader.find((c: string) => c.startsWith('refresh_token='))!;
    const cookieValue = rtCookie.split(';')[0];

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieValue);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('returns 401 when no refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for tampered refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=totally.invalid.jwt');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user profile with valid access token', async () => {
    // Login to get fresh token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });
    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(ADMIN_EMAIL);
    expect(res.body.data.role).toBe('admin');
    expect(res.body.data.is_active).toBe(true);
    // Should NOT expose password_hash
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer garbage.token.here');

    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    // Sign a token that expired 1 second ago
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.default.sign(
      { userId: '00000000-0000-0000-0000-000000000000', email: 'x@x.com', role: 'admin' },
      process.env['JWT_ACCESS_SECRET']!,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears refresh cookie and returns success', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });
    const cookieHeader = loginRes.headers['set-cookie'] as string[];
    const rtCookie = cookieHeader.find((c: string) => c.startsWith('refresh_token='))!;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', rtCookie.split(';')[0]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify cookie is cleared
    const setCookie = res.headers['set-cookie'] as string[];
    const clearedCookie = setCookie?.find((c: string) => c.startsWith('refresh_token='));
    expect(clearedCookie).toBeDefined();
    // A cleared cookie has empty value or Max-Age=0
    const isCleared =
      clearedCookie?.includes('Max-Age=0') ||
      clearedCookie?.includes('Expires=') ||
      clearedCookie?.startsWith('refresh_token=;');
    expect(isCleared).toBe(true);
  });

  it('succeeds even without a refresh cookie (idempotent)', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
