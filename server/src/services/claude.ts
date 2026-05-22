// ============================================================
// Hub Workspace — Claude AI Service
// ============================================================
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../errors';
import { PACKET_ERROR_CODES } from '../constants';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new AppError(
        'ANTHROPIC_API_KEY が設定されていません',
        PACKET_ERROR_CODES.DNA_SUMMARY_FAILED,
        500
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Given client DNA items and a task context, extract and summarize only
 * the relevant DNA items in 200 chars max (Japanese).
 */
export async function summarizeDnaForTask(
  dnaItems: Array<{ category: string; content: string }>,
  taskTitle: string,
  taskDescription: string
): Promise<string> {
  if (dnaItems.length === 0) {
    return '';
  }

  const dnaText = dnaItems
    .map((d) => `[${d.category}] ${d.content}`)
    .join('\n');

  const prompt = `以下はクライアントのDNA情報（ブランド・特性・要件の記録）です。

## クライアントDNA
${dnaText}

## タスク情報
タイトル: ${taskTitle}
説明: ${taskDescription || '（説明なし）'}

上記のタスクを実行するために特に関連するDNA情報を抽出し、200文字以内の日本語で簡潔にまとめてください。
関連性のないDNA情報は除外してください。要約のみを返してください。`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return '';
    }
    // Truncate to 200 chars just in case
    return content.text.trim().slice(0, 200);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      `DNA要約の生成に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      PACKET_ERROR_CODES.DNA_SUMMARY_FAILED,
      500
    );
  }
}

/**
 * Generates a 100-char max Japanese summary of a task.
 * Uses claude-haiku-4-5-20251001 for cost efficiency.
 */
export async function generateTaskSummary(task: {
  title: string;
  description: string;
  status: string;
  priority: string;
}): Promise<string> {
  const prompt = `以下のタスク情報を100文字以内の日本語で簡潔に要約してください。要約のみを返してください。

タイトル: ${task.title}
説明: ${task.description || '（説明なし）'}
ステータス: ${task.status}
優先度: ${task.priority}`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return task.title;
    }
    return content.text.trim().slice(0, 100);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      `タスク要約の生成に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      PACKET_ERROR_CODES.DNA_SUMMARY_FAILED,
      500
    );
  }
}
