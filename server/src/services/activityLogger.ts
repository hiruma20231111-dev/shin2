// ============================================================
// Hub Workspace — Activity Logger Service
// ============================================================
// Records all hub operations to activity_logs table
import { query } from '../db/pool';

interface LogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  changes?: unknown;
}

export async function logActivity(params: LogParams): Promise<void> {
  await query(
    `INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, client_id, project_id, task_id, changes)
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.userId,
      params.action,
      params.entityType,
      params.entityId,
      params.clientId ?? null,
      params.projectId ?? null,
      params.taskId ?? null,
      params.changes ? JSON.stringify(params.changes) : null,
    ]
  );
}
