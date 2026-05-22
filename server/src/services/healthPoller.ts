// ============================================================
// Hub Workspace — Tool Health Poller
// ============================================================
// Polls registered tool health endpoints every 60s
// Uses Node.js fetch (available in Node 18+)
import { query } from '../db/pool';
import { HEALTH_POLL_INTERVAL_MS, TOOL_STATUS } from '../constants';

async function checkToolHealth(toolId: string, healthEndpoint: string): Promise<void> {
  let status: string;
  try {
    const response = await fetch(healthEndpoint, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      status = body['status'] === 'degraded' ? TOOL_STATUS.DEGRADED : TOOL_STATUS.ONLINE;
    } else {
      status = TOOL_STATUS.DEGRADED;
    }
  } catch {
    status = TOOL_STATUS.OFFLINE;
  }
  await query(
    'UPDATE tools SET status = $1, last_health_check = now() WHERE id = $2',
    [status, toolId]
  );
}

export async function pollAllTools(): Promise<void> {
  const result = await query<{ id: string; health_endpoint: string }>(
    'SELECT id, health_endpoint FROM tools WHERE is_active = true',
  );
  await Promise.allSettled(
    result.rows.map((row) => checkToolHealth(row.id, row.health_endpoint)),
  );
}

export function startHealthPoller(): ReturnType<typeof setInterval> {
  pollAllTools().catch(console.error);
  return setInterval(() => pollAllTools().catch(console.error), HEALTH_POLL_INTERVAL_MS);
}

// Export for direct use in toolRegistry route
export { checkToolHealth };
