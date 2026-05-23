// ============================================================
// Hub Workspace — AI Advisor (Claude Sonnet 4.6)
// ============================================================
// Provides progress summaries and tool-usage recommendations.
// Uses prompt caching to amortize the system prompt across calls.
import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/pool';

const MODEL = 'claude-sonnet-4-6';

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return null;
  if (!_client) {
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export function isAiEnabled(): boolean {
  return !!process.env['ANTHROPIC_API_KEY'];
}

const ADVISOR_SYSTEM_PROMPT = `あなたは「ハブワークスペース」というプロジェクト管理SaaSのAIアドバイザーです。
ユーザーは独立を目指す個人事業主・小規模事業者で、複数のクライアント案件を並行で管理しています。

役割：
1. 訪問時に**現状の進捗を短く要約**して共有する
2. プロジェクトの目的に応じて**適切なツールの活用を推奨**する
3. ボトルネックや停滞を見つけたら**具体的な次のアクション**を提案する
4. 必要に応じて**ビジネスアドバイザーとして助言**する（収益化、優先順位、リソース配分）

スタイル：
- 日本語で回答
- 簡潔（重要点は3〜5項目以内、各項目1〜2行）
- 数値や日付を具体的に
- 不明な点は推測せず「データ不足」と明示
- マークダウンの見出しは使わず、必要に応じて箇条書き

返答の構成（指示がない限り）：
**📊 現状サマリー** — 1〜2文の全体感
**🎯 注目ポイント** — 具体的な数値とアクション（3項目以内）
**💡 推奨アクション** — 次の一手（1〜2項目）`;

export interface DashboardContext {
  projectCount: number;
  activeProjects: number;
  taskStats: { todo: number; in_progress: number; review: number; done: number };
  overdueTasks: number;
  upcomingDeadlines: Array<{ task: string; project: string; due_date: string }>;
  recentActivity: Array<{ action: string; entity_type: string; created_at: string }>;
}

export interface ProjectContext {
  project: {
    name: string;
    description: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
  };
  client: { name: string; industry: string } | null;
  taskStats: { todo: number; in_progress: number; review: number; done: number };
  upcomingTasks: Array<{ title: string; status: string; due_date: string | null }>;
  overdueTasks: Array<{ title: string; due_date: string | null }>;
  availableTools: Array<{ identifier: string; name: string; description: string; status: string }>;
  assignedTools: string[];
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const client = getClient();
  if (!client) {
    return 'AIアドバイザーは現在無効化されています（ANTHROPIC_API_KEYが未設定）。';
  }
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

export async function buildDashboardContext(): Promise<DashboardContext> {
  const projects = await query<{ count: string; active: string }>(
    `SELECT COUNT(*)::text AS count,
            COUNT(*) FILTER (WHERE status IN ('active', 'review'))::text AS active
     FROM projects`,
  );
  const tasks = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM tasks GROUP BY status`,
  );
  const overdue = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tasks
     WHERE status NOT IN ('done') AND due_date < CURRENT_DATE`,
  );
  const upcoming = await query<{ title: string; name: string; due_date: string }>(
    `SELECT t.title, p.name, t.due_date::text AS due_date
     FROM tasks t JOIN projects p ON p.id = t.project_id
     WHERE t.status NOT IN ('done') AND t.due_date IS NOT NULL
       AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
     ORDER BY t.due_date ASC LIMIT 8`,
  );
  const activity = await query<{ action: string; entity_type: string; created_at: string }>(
    `SELECT action, entity_type, created_at::text
     FROM activity_logs ORDER BY created_at DESC LIMIT 10`,
  );

  const stats = { todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const r of tasks.rows) {
    const k = r.status as keyof typeof stats;
    if (k in stats) stats[k] = parseInt(r.count, 10);
  }

  return {
    projectCount: parseInt(projects.rows[0]?.count ?? '0', 10),
    activeProjects: parseInt(projects.rows[0]?.active ?? '0', 10),
    taskStats: stats,
    overdueTasks: parseInt(overdue.rows[0]?.count ?? '0', 10),
    upcomingDeadlines: upcoming.rows.map((r) => ({
      task: r.title,
      project: r.name,
      due_date: r.due_date,
    })),
    recentActivity: activity.rows,
  };
}

export async function buildProjectContext(projectId: string): Promise<ProjectContext | null> {
  const projRes = await query<{
    name: string;
    description: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    client_id: string;
  }>(
    `SELECT name, description, status,
            start_date::text AS start_date,
            end_date::text AS end_date,
            client_id
     FROM projects WHERE id = $1`,
    [projectId],
  );
  if (projRes.rows.length === 0) return null;
  const project = projRes.rows[0];

  const clientRes = await query<{ name: string; industry: string }>(
    `SELECT name, industry FROM clients WHERE id = $1`,
    [project.client_id],
  );
  const client = clientRes.rows[0] ?? null;

  const taskRes = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM tasks WHERE project_id = $1 GROUP BY status`,
    [projectId],
  );
  const stats = { todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const r of taskRes.rows) {
    const k = r.status as keyof typeof stats;
    if (k in stats) stats[k] = parseInt(r.count, 10);
  }

  const upcomingRes = await query<{ title: string; status: string; due_date: string | null }>(
    `SELECT title, status, due_date::text AS due_date
     FROM tasks WHERE project_id = $1 AND status != 'done'
     ORDER BY due_date NULLS LAST, order_index LIMIT 10`,
    [projectId],
  );
  const overdueRes = await query<{ title: string; due_date: string | null }>(
    `SELECT title, due_date::text AS due_date
     FROM tasks
     WHERE project_id = $1 AND status != 'done'
       AND due_date IS NOT NULL AND due_date < CURRENT_DATE
     ORDER BY due_date ASC`,
    [projectId],
  );

  const toolsRes = await query<{
    identifier: string;
    name: string;
    description: string;
    status: string;
  }>(
    `SELECT identifier, name, description, status FROM tools WHERE is_active = true ORDER BY name`,
  );

  const assignedRes = await query<{ assigned_tool: string }>(
    `SELECT DISTINCT assigned_tool FROM tasks
     WHERE project_id = $1 AND assigned_tool IS NOT NULL`,
    [projectId],
  );

  return {
    project,
    client,
    taskStats: stats,
    upcomingTasks: upcomingRes.rows,
    overdueTasks: overdueRes.rows,
    availableTools: toolsRes.rows,
    assignedTools: assignedRes.rows.map((r) => r.assigned_tool),
  };
}

export async function generateDashboardSummary(ctx: DashboardContext): Promise<string> {
  const userPrompt = `今、ユーザーがダッシュボードを開きました。以下の現状データから、進捗サマリーと注目すべきポイントを共有してください。

【現状データ】
- プロジェクト総数: ${ctx.projectCount}件（うちアクティブ: ${ctx.activeProjects}件）
- タスク状況: ToDo ${ctx.taskStats.todo}件 / 進行中 ${ctx.taskStats.in_progress}件 / レビュー ${ctx.taskStats.review}件 / 完了 ${ctx.taskStats.done}件
- 期限超過タスク: ${ctx.overdueTasks}件

【今後14日以内の締切】
${ctx.upcomingDeadlines.length === 0 ? '（なし）' : ctx.upcomingDeadlines.map((d) => `- ${d.due_date}: 「${d.task}」(${d.project})`).join('\n')}

【最近のアクティビティ】
${ctx.recentActivity.slice(0, 5).map((a) => `- ${a.action} (${a.entity_type})`).join('\n')}`;

  return callClaude(ADVISOR_SYSTEM_PROMPT, userPrompt);
}

export async function generateProjectAdvice(ctx: ProjectContext): Promise<string> {
  const userPrompt = `プロジェクト「${ctx.project.name}」を開きました。プロジェクトの目的に対する進捗評価、ボトルネックの特定、そして登録済みツールの中から推奨する活用方法を助言してください。

【プロジェクト概要】
- 名称: ${ctx.project.name}
- クライアント: ${ctx.client ? `${ctx.client.name}（${ctx.client.industry}）` : '未設定'}
- 説明: ${ctx.project.description || '（説明なし）'}
- ステータス: ${ctx.project.status}
- 期間: ${ctx.project.start_date ?? '未設定'} 〜 ${ctx.project.end_date ?? '未設定'}

【タスク状況】
ToDo ${ctx.taskStats.todo}件 / 進行中 ${ctx.taskStats.in_progress}件 / レビュー ${ctx.taskStats.review}件 / 完了 ${ctx.taskStats.done}件

【期限超過タスク】
${ctx.overdueTasks.length === 0 ? '（なし）' : ctx.overdueTasks.map((t) => `- 「${t.title}」(期限: ${t.due_date})`).join('\n')}

【直近のタスク】
${ctx.upcomingTasks.slice(0, 6).map((t) => `- [${t.status}] ${t.title}${t.due_date ? `（期限: ${t.due_date}）` : ''}`).join('\n')}

【利用可能なツール】
${ctx.availableTools.map((t) => `- ${t.identifier} (${t.name}) [${t.status}]: ${t.description}`).join('\n')}

【現在このプロジェクトで使用中のツール】
${ctx.assignedTools.length === 0 ? '（なし）' : ctx.assignedTools.join(', ')}

プロジェクトの目的・状況を踏まえ、未使用ツールも含めて推奨を行ってください。`;

  return callClaude(ADVISOR_SYSTEM_PROMPT, userPrompt);
}
