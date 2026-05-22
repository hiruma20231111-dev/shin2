// ============================================================
// Hub Workspace — Express Application Entry Point
// ============================================================
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth';
import clientsRoutes from './routes/clients';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import toolRegistryRoutes from './routes/toolRegistry';
import dashboardRoutes from './routes/dashboard';
import templatesRoutes from './routes/templates';
import activityLogRoutes from './routes/activityLog';
import invoicesRoutes from './routes/invoices';
import workflowsRoutes from './routes/workflows';
import { errorHandler } from './middleware/errorHandler';
import { startHealthPoller } from './services/healthPoller';
import { AppError } from './errors';
import { API_ERROR_CODES } from './constants';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ── Health check (public) ─────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'hub-workspace', time: new Date().toISOString() });
});

// ── Mount routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/tools', toolRegistryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/activity', activityLogRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/workflows', workflowsRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError('エンドポイントが見つかりません', API_ERROR_CODES.NOT_FOUND, 404));
});

// ── Global error handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start server + health poller ──────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  startHealthPoller();
});

export default app;
