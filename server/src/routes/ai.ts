// ============================================================
// Hub Workspace — AI Advisor Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import {
  isAiEnabled,
  buildDashboardContext,
  buildProjectContext,
  generateDashboardSummary,
  generateProjectAdvice,
} from '../services/aiAdvisor';
import { AppError } from '../errors';
import { API_ERROR_CODES } from '../constants';

const router = Router();
router.use(authenticate);

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { enabled: isAiEnabled(), model: 'claude-sonnet-4-6' },
  });
});

router.get('/dashboard-summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = await buildDashboardContext();
    const summary = await generateDashboardSummary(ctx);
    res.json({ success: true, data: { summary, context: ctx } });
  } catch (e) {
    next(e);
  }
});

router.get('/project-advice/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params['projectId'];
    if (!projectId) {
      throw new AppError('projectId が必要です', API_ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const ctx = await buildProjectContext(projectId);
    if (!ctx) {
      throw new AppError('プロジェクトが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    const advice = await generateProjectAdvice(ctx);
    res.json({ success: true, data: { advice, context: ctx } });
  } catch (e) {
    next(e);
  }
});

export default router;
