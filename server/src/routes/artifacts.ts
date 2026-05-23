// ============================================================
// Hub Workspace — Project Artifacts Routes
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { AppError } from '../errors';
import { API_ERROR_CODES } from '../constants';
import { logActivity } from '../services/activityLogger';

const router = Router({ mergeParams: true });
router.use(authenticate);

const artifactSchema = z.object({
  task_id: z.string().uuid().nullish(),
  tool_identifier: z.string().nullish(),
  title: z.string().min(1, 'タイトルを入力してください'),
  artifact_type: z.enum(['file', 'url', 'text', 'image', 'json']).default('url'),
  content: z.string().nullish(),
  url: z.string().nullish(),
  metadata: z.record(z.unknown()).default({}),
});

interface ArtifactRow {
  id: string;
  project_id: string;
  task_id: string | null;
  tool_identifier: string | null;
  title: string;
  artifact_type: string;
  content: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params['projectId'];
    const result = await query<ArtifactRow>(
      `SELECT * FROM project_artifacts WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params['projectId'];
    const body = artifactSchema.parse(req.body);
    if (!body.url && !body.content) {
      throw new AppError(
        'url か content のいずれかが必須です',
        API_ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }
    const result = await query<ArtifactRow>(
      `INSERT INTO project_artifacts
         (project_id, task_id, tool_identifier, title, artifact_type, content, url, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        projectId,
        body.task_id ?? null,
        body.tool_identifier ?? null,
        body.title,
        body.artifact_type,
        body.content ?? null,
        body.url ?? null,
        JSON.stringify(body.metadata),
        req.user!.userId,
      ],
    );
    await logActivity({
      userId: req.user!.userId,
      projectId,
      action: 'artifact.created',
      entityType: 'artifact',
      entityId: result.rows[0].id,
    });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

router.delete('/:artifactId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params['projectId'];
    const artifactId = req.params['artifactId'];
    const result = await query(
      `DELETE FROM project_artifacts WHERE id = $1 AND project_id = $2`,
      [artifactId, projectId],
    );
    if (result.rowCount === 0) {
      throw new AppError('成果物が見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
    }
    res.json({ success: true, data: null });
  } catch (e) {
    next(e);
  }
});

export default router;
