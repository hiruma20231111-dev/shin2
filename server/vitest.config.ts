import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://hub_user:hub_pass@localhost:5432/hub_workspace',
      JWT_ACCESS_SECRET: 'test-access-secret-32chars-for-testing',
      JWT_REFRESH_SECRET: 'test-refresh-secret-32chars-fortesting',
      JWT_ACCESS_EXPIRES_IN: '900',
      JWT_REFRESH_EXPIRES_IN: '604800',
      PORT: '3099',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/db/migrate.ts', 'src/db/seed.ts'],
    },
    testTimeout: 10000,
  },
});
