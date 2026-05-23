// ============================================================
// Hub Workspace — External Tool Integration Routes
// ============================================================
// Public-ish endpoints (no JWT, but require tool API key) used by
// external tools to fetch project context and submit results back.
//
// Authentication model:
//   - Each project has a stable `integration_key` (random 32-char hex)
//   - Each tool has an `api_key` (shown ONCE on creation, hashed in DB)
//   - Tools send:  X-Tool-Api-Key: <api_key>   header
//   - URL path includes the project's integration_key
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool';
import { AppError } from '../errors';
import { API_ERROR_CODES, BCRYPT_ROUNDS } from '../constants';

const router = Router();

interface ToolRow {
  id: string;
  identifier: string;
  name: string;
  api_key_hash: string | null;
  api_key_prefix: string | null;
  is_active: boolean;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  status: string;
  client_id: string;
  integration_key: string;
}

async function authenticateTool(req: Request): Promise<ToolRow> {
  const apiKey = req.header('x-tool-api-key');
  if (!apiKey || apiKey.length < 32) {
    throw new AppError('X-Tool-Api-Key ヘッダーが必要です', API_ERROR_CODES.UNAUTHORIZED, 401);
  }
  const prefix = apiKey.slice(0, 8);
  const candidates = await query<ToolRow>(
    `SELECT id, identifier, name, api_key_hash, api_key_prefix, is_active
     FROM tools WHERE api_key_prefix = $1 AND is_active = true`,
    [prefix],
  );
  for (const tool of candidates.rows) {
    if (!tool.api_key_hash) continue;
    const match = await bcrypt.compare(apiKey, tool.api_key_hash);
    if (match) return tool;
  }
  throw new AppError('ツールの認証に失敗しました', API_ERROR_CODES.UNAUTHORIZED, 401);
}

async function findProjectByKey(integrationKey: string): Promise<ProjectRow> {
  const result = await query<ProjectRow>(
    `SELECT id, name, description, status, client_id, integration_key
     FROM projects WHERE integration_key = $1`,
    [integrationKey],
  );
  if (result.rows.length === 0) {
    throw new AppError('プロジェクトが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
  }
  return result.rows[0];
}

// ── GET /api/integrations/projects/:key/context ──────────────
// Returns project info, client info, and tasks. Used by external
// tools when starting work on a project.
router.get('/projects/:key/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tool = await authenticateTool(req);
    const key = req.params['key'];
    if (!key) {
      throw new AppError('integration_key が必要です', API_ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const project = await findProjectByKey(key);
    const client = await query<{ id: string; name: string; industry: string }>(
      `SELECT id, name, industry FROM clients WHERE id = $1`,
      [project.client_id],
    );
    const tasks = await query<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority: string;
      assigned_tool: string | null;
      start_date: string | null;
      due_date: string | null;
    }>(
      `SELECT id, title, description, status, priority, assigned_tool,
              start_date::text AS start_date, due_date::text AS due_date
       FROM tasks WHERE project_id = $1 ORDER BY order_index, created_at`,
      [project.id],
    );
    const dna = await query<{ category: string; content: string }>(
      `SELECT category, content FROM client_dna WHERE client_id = $1 ORDER BY category`,
      [project.client_id],
    );
    res.json({
      success: true,
      schema_version: '1.0.0',
      data: {
        project: {
          id: project.id,
          integration_key: project.integration_key,
          name: project.name,
          description: project.description,
          status: project.status,
        },
        client: client.rows[0] ?? null,
        client_dna: dna.rows,
        tasks: tasks.rows,
        requesting_tool: {
          identifier: tool.identifier,
          name: tool.name,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/integrations/projects/:key/artifacts ───────────
// Tools submit their output as project artifacts (the "deliverable").
const artifactSubmissionSchema = z.object({
  task_id: z.string().uuid().nullish(),
  title: z.string().min(1),
  artifact_type: z.enum(['file', 'url', 'text', 'image', 'json']).default('url'),
  content: z.string().nullish(),
  url: z.string().nullish(),
  metadata: z.record(z.unknown()).default({}),
});

router.post('/projects/:key/artifacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tool = await authenticateTool(req);
    const key = req.params['key'];
    if (!key) {
      throw new AppError('integration_key が必要です', API_ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const project = await findProjectByKey(key);
    const body = artifactSubmissionSchema.parse(req.body);
    if (!body.url && !body.content) {
      throw new AppError(
        'url か content のいずれかが必須です',
        API_ERROR_CODES.VALIDATION_ERROR,
        400,
      );
    }
    const result = await query<{ id: string }>(
      `INSERT INTO project_artifacts
         (project_id, task_id, tool_identifier, title, artifact_type, content, url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        project.id,
        body.task_id ?? null,
        tool.identifier,
        body.title,
        body.artifact_type,
        body.content ?? null,
        body.url ?? null,
        JSON.stringify(body.metadata),
      ],
    );
    res.status(201).json({
      success: true,
      schema_version: '1.0.0',
      data: { artifact_id: result.rows[0].id },
    });
  } catch (e) {
    next(e);
  }
});

// ── POST /api/integrations/projects/:key/tasks/:taskId/status ──
// Tools update task status when starting/completing work.
const statusUpdateSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  note: z.string().nullish(),
});

router.post(
  '/projects/:key/tasks/:taskId/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tool = await authenticateTool(req);
      const key = req.params['key'];
      const taskId = req.params['taskId'];
      if (!key || !taskId) {
        throw new AppError('パラメータ不足', API_ERROR_CODES.VALIDATION_ERROR, 400);
      }
      const project = await findProjectByKey(key);
      const body = statusUpdateSchema.parse(req.body);
      const result = await query<{ id: string; status: string }>(
        `UPDATE tasks SET status = $1, updated_at = now()
         WHERE id = $2 AND project_id = $3
         RETURNING id, status`,
        [body.status, taskId, project.id],
      );
      if (result.rows.length === 0) {
        throw new AppError('タスクが見つかりません', API_ERROR_CODES.NOT_FOUND, 404);
      }
      // Log to activity (optional, no user since this is a tool)
      await query(
        `INSERT INTO activity_logs (user_id, project_id, task_id, action, entity_type, entity_id, changes)
         SELECT id, $1, $2, $3, 'task', $2, $4 FROM users WHERE role = 'admin' LIMIT 1`,
        [
          project.id,
          taskId,
          `task.status_by_tool:${tool.identifier}`,
          JSON.stringify({ status: body.status, note: body.note }),
        ],
      );
      res.json({ success: true, data: result.rows[0] });
    } catch (e) {
      next(e);
    }
  },
);

// ── GET /api/integrations/health ──────────────────────────────
// Tool health check (no auth) — used to verify the hub is reachable
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    schema_version: '1.0.0',
    service: 'hub-workspace-integration',
    time: new Date().toISOString(),
  });
});

export default router;

// Export bcrypt helper for use in tool registration
export async function generateToolApiKey(): Promise<{
  apiKey: string;
  prefix: string;
  hash: string;
}> {
  const crypto = await import('crypto');
  const apiKey = `hub_${crypto.randomBytes(24).toString('hex')}`;
  const prefix = apiKey.slice(0, 8);
  const hash = await bcrypt.hash(apiKey, BCRYPT_ROUNDS);
  return { apiKey, prefix, hash };
}
