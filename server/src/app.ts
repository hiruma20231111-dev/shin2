// ============================================================
// Hub Workspace — Express App (testable, no listen())
// ============================================================
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
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';
import artifactsRoutes from './routes/artifacts';
import { errorHandler } from './middleware/errorHandler';
import { AppError } from './errors';
import { API_ERROR_CODES } from './constants';
import { ensureInitialized } from './db/initialize';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  }),
);
if (process.env['NODE_ENV'] !== 'test') {
  app.use(morgan('dev'));
}
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'hub-workspace', time: new Date().toISOString() });
});

// Auto-run DB migrations on first request (idempotent — safe to re-run)
app.use((_req: Request, _res: Response, next: NextFunction) => {
  ensureInitialized().then(() => next()).catch(next);
});

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
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/projects/:projectId/artifacts', artifactsRoutes);

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError('エンドポイントが見つかりません', API_ERROR_CODES.NOT_FOUND, 404));
});

app.use(errorHandler);

export default app;
