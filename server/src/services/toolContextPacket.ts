// ============================================================
// Hub Workspace — Tool Context Packet Service
// ============================================================
import { query } from '../db/pool';
import { summarizeDnaForTask } from './claude';
import { TOOL_CONTEXT_PACKET_SCHEMA_VERSION, PACKET_ERROR_CODES, TASK_STATUS } from '../constants';
import { AppError } from '../errors';
import type { ToolContextPacket } from '../types';

interface TaskWithContext {
  task_id: string;
  task_title: string;
  task_description: string;
  task_status: string;
  task_priority: string;
  assigned_tool: string | null;
  project_id: string;
  project_name: string;
  project_description: string;
  client_id: string;
  client_name: string;
  client_industry: string;
}

interface DnaItem {
  category: string;
  content: string;
}

interface ToolRecord {
  id: string;
  identifier: string;
  name: string;
  endpoint_url: string;
  status: string;
}

export async function buildAndSendPacket(
  taskId: string,
  _userId: string
): Promise<{ packetId: string }> {
  // ── 1. Load task + project + client ────────────────────────
  const taskResult = await query<TaskWithContext>(
    `SELECT
       t.id            AS task_id,
       t.title         AS task_title,
       t.description   AS task_description,
       t.status        AS task_status,
       t.priority      AS task_priority,
       t.assigned_tool,
       p.id            AS project_id,
       p.name          AS project_name,
       p.description   AS project_description,
       c.id            AS client_id,
       c.name          AS client_name,
       c.industry      AS client_industry
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN clients c  ON c.id = p.client_id
     WHERE t.id = $1`,
    [taskId]
  );

  if (taskResult.rows.length === 0) {
    throw new AppError(
      `タスクが見つかりません: ${taskId}`,
      PACKET_ERROR_CODES.TOOL_NOT_FOUND,
      404
    );
  }

  const ctx = taskResult.rows[0];

  if (!ctx.assigned_tool) {
    throw new AppError(
      'このタスクにはツールが割り当てられていません',
      PACKET_ERROR_CODES.TOOL_NOT_FOUND,
      400
    );
  }

  // ── 2. Load client DNA ─────────────────────────────────────
  const dnaResult = await query<DnaItem>(
    `SELECT category, content FROM client_dna WHERE client_id = $1 ORDER BY created_at`,
    [ctx.client_id]
  );
  const dnaItems: DnaItem[] = dnaResult.rows;

  // ── 3. Summarize DNA for this task ─────────────────────────
  const dnaSummary = await summarizeDnaForTask(
    dnaItems,
    ctx.task_title,
    ctx.task_description
  );

  // ── 4. Load target tool ────────────────────────────────────
  const toolResult = await query<ToolRecord>(
    `SELECT id, identifier, name, endpoint_url, status FROM tools WHERE identifier = $1 AND is_active = true`,
    [ctx.assigned_tool]
  );

  if (toolResult.rows.length === 0) {
    throw new AppError(
      `ツールが見つかりません: ${ctx.assigned_tool}`,
      PACKET_ERROR_CODES.TOOL_NOT_FOUND,
      404
    );
  }

  const tool = toolResult.rows[0];

  // ── 5. Check tool is online ────────────────────────────────
  if (tool.status !== 'online') {
    throw new AppError(
      `ツール「${tool.name}」は現在オフラインです (status: ${tool.status})`,
      PACKET_ERROR_CODES.TOOL_OFFLINE,
      503
    );
  }

  // ── 6. Build ToolContextPacket ─────────────────────────────
  const sentAt = new Date().toISOString();
  const packet: ToolContextPacket = {
    schema_version: TOOL_CONTEXT_PACKET_SCHEMA_VERSION,
    task_id: ctx.task_id,
    client: {
      id: ctx.client_id,
      name: ctx.client_name,
      industry: ctx.client_industry,
      dna_summary: dnaSummary,
    },
    project: {
      id: ctx.project_id,
      name: ctx.project_name,
      description: ctx.project_description,
    },
    tool_target: ctx.assigned_tool,
    payload: {
      task: {
        id: ctx.task_id,
        title: ctx.task_title,
        description: ctx.task_description,
        status: ctx.task_status,
        priority: ctx.task_priority,
      },
    },
    sent_at: sentAt,
  };

  // ── 7. INSERT packet record (status='pending') ─────────────
  const insertResult = await query(
    `INSERT INTO tool_context_packets
       (id, task_id, tool_identifier, schema_version, direction, payload, status)
     VALUES (uuid_generate_v4(), $1, $2, $3, 'sent', $4, 'pending')
     RETURNING id`,
    [
      taskId,
      ctx.assigned_tool,
      TOOL_CONTEXT_PACKET_SCHEMA_VERSION,
      JSON.stringify(packet),
    ]
  );

  const packetId: string = insertResult.rows[0].id as string;

  // ── 8. POST packet to tool endpoint ───────────────────────
  try {
    const response = await fetch(`${tool.endpoint_url}/api/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text().catch(() => '')}`);
    }
  } catch (fetchErr) {
    // ── On fetch error: mark packet as error ─────────────────
    await query(
      `UPDATE tool_context_packets
       SET status = 'error',
           error_code = $1,
           error_message = $2
       WHERE id = $3`,
      [
        PACKET_ERROR_CODES.TOOL_UNREACHABLE,
        fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        packetId,
      ]
    );
    throw new AppError(
      `ツールへの接続に失敗しました: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
      PACKET_ERROR_CODES.TOOL_UNREACHABLE,
      503
    );
  }

  // ── 9. Update packet status to 'sent' ─────────────────────
  await query(
    `UPDATE tool_context_packets
     SET status = 'sent', sent_at = now()
     WHERE id = $1`,
    [packetId]
  );

  // ── 10. Return packetId ────────────────────────────────────
  return { packetId };
}

export async function receivePacketResult(
  packetId: string,
  result: Record<string, unknown>
): Promise<void> {
  // Get original packet to find task_id
  const packetResult = await query(
    `SELECT task_id, tool_identifier, schema_version FROM tool_context_packets WHERE id = $1`,
    [packetId]
  );

  if (packetResult.rows.length === 0) {
    throw new AppError(
      `パケットが見つかりません: ${packetId}`,
      PACKET_ERROR_CODES.TOOL_NOT_FOUND,
      404
    );
  }

  const original = packetResult.rows[0] as {
    task_id: string;
    tool_identifier: string;
    schema_version: string;
  };

  // INSERT new received packet
  await query(
    `INSERT INTO tool_context_packets
       (id, task_id, tool_identifier, schema_version, direction, payload, result, status, received_at)
     VALUES (uuid_generate_v4(), $1, $2, $3, 'received', $4, $4, 'received', now())`,
    [
      original.task_id,
      original.tool_identifier,
      original.schema_version,
      JSON.stringify(result),
    ]
  );

  // Update original sent packet with result
  await query(
    `UPDATE tool_context_packets
     SET result = $1, status = 'received', received_at = now()
     WHERE id = $2`,
    [JSON.stringify(result), packetId]
  );

  // Update task status to 'done'
  await query(
    `UPDATE tasks SET status = $1 WHERE id = $2`,
    [TASK_STATUS.DONE, original.task_id]
  );
}
