import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../stores/toastStore';
import type { Project } from '../../types';

export function IntegrationKeyPanel({ project }: { project: Project }) {
  const addToast = useToastStore((s) => s.addToast);
  const [showDocs, setShowDocs] = useState(false);
  const key = project.integration_key;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (!key) return null;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    addToast({ type: 'success', message: `${label}をコピーしました` });
  }

  return (
    <Card className="border-l-2 border-l-emerald-500/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">
          🔌 ツール連携キー
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setShowDocs(!showDocs)}>
          {showDocs ? 'ガイドを閉じる' : '連携ガイドを表示'}
        </Button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        外部ツール（プロンプトビルダー、LP制作ツール等）からこのプロジェクトを参照するための識別子です。
        各ツールにこのキーを設定すると、結果がこのプロジェクトの「成果物」タブに自動登録されます。
      </p>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">
            Integration Key
          </label>
          <div className="flex gap-2 mt-1">
            <code className="flex-1 text-xs bg-surface-700 rounded px-2 py-1.5 font-mono text-gray-100 break-all">
              {key}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copy(key, 'Integration Key')}
            >
              コピー
            </Button>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider">
            Hub Base URL
          </label>
          <div className="flex gap-2 mt-1">
            <code className="flex-1 text-xs bg-surface-700 rounded px-2 py-1.5 font-mono text-gray-100 break-all">
              {baseUrl}/api/integrations
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copy(`${baseUrl}/api/integrations`, 'Base URL')}
            >
              コピー
            </Button>
          </div>
        </div>
      </div>

      {showDocs && (
        <div className="mt-4 pt-4 border-t border-surface-700 space-y-3 text-xs text-gray-300">
          <div>
            <h4 className="font-semibold text-gray-200 mb-1">📥 プロジェクト情報を取得</h4>
            <pre className="bg-surface-900 rounded p-2 overflow-x-auto text-[10px] leading-relaxed">{`GET ${baseUrl}/api/integrations/projects/${key}/context
Headers:
  X-Tool-Api-Key: hub_xxxxxxxxxxxx...

Response:
{
  "success": true,
  "schema_version": "1.0.0",
  "data": {
    "project": { "id", "name", "description", "status" },
    "client": { "name", "industry" },
    "client_dna": [{ "category", "content" }],
    "tasks": [{ "id", "title", "status", "due_date", ... }]
  }
}`}</pre>
          </div>

          <div>
            <h4 className="font-semibold text-gray-200 mb-1">📤 成果物を送信</h4>
            <pre className="bg-surface-900 rounded p-2 overflow-x-auto text-[10px] leading-relaxed">{`POST ${baseUrl}/api/integrations/projects/${key}/artifacts
Headers:
  X-Tool-Api-Key: hub_xxxxxxxxxxxx...
  Content-Type: application/json

Body:
{
  "task_id": "uuid (optional)",
  "title": "完成LPのデモURL",
  "artifact_type": "url",
  "url": "https://result.example.com",
  "content": "備考 (optional)",
  "metadata": { "version": "1.0" }
}`}</pre>
          </div>

          <div>
            <h4 className="font-semibold text-gray-200 mb-1">🔄 タスクのステータスを更新</h4>
            <pre className="bg-surface-900 rounded p-2 overflow-x-auto text-[10px] leading-relaxed">{`POST ${baseUrl}/api/integrations/projects/${key}/tasks/{task_id}/status
Headers:
  X-Tool-Api-Key: hub_xxxxxxxxxxxx...

Body:
{ "status": "in_progress" | "review" | "done", "note": "..." }`}</pre>
          </div>

          <div className="bg-violet-950/30 border border-violet-700/30 rounded p-2">
            <p className="font-semibold text-violet-200 mb-1">💡 共通プロトコル</p>
            <ul className="space-y-0.5 list-disc list-inside text-[11px]">
              <li>すべてのレスポンスは <code>success</code>, <code>schema_version</code>, <code>data</code> を持つ</li>
              <li>エラー時は <code>{`{ success: false, error: { code, message } }`}</code></li>
              <li>日時はISO 8601 (UTC)、日付は <code>YYYY-MM-DD</code></li>
              <li>schema_version は現在 <code>1.0.0</code></li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
