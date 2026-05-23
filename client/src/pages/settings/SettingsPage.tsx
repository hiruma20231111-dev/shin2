import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { toolsApi } from '../../lib/api';
import { useToastStore } from '../../stores/toastStore';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'apikeys' | 'protocol'>('apikeys');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">設定</h1>
        <p className="text-sm text-gray-400 mt-0.5">APIキー管理・連携プロトコル設定</p>
      </div>

      <div className="flex gap-1 border-b border-surface-700">
        {([
          { key: 'apikeys', label: '🔑 APIキー管理' },
          { key: 'protocol', label: '📋 連携プロトコル' },
        ] as { key: typeof activeTab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'apikeys' && <ApiKeyManagement />}
      {activeTab === 'protocol' && <ProtocolDocs />}
    </div>
  );
}

function ApiKeyManagement() {
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<{ toolName: string; apiKey: string } | null>(null);

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await toolsApi.list();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => toolsApi.regenerateKey(id),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: ['tools'] });
      const tool = tools.find((t) => t.id === id);
      if (res.data.success) {
        setNewKey({ toolName: tool?.name ?? id, apiKey: res.data.data.api_key });
      }
      setRegeneratingId(null);
    },
    onError: () => {
      addToast({ type: 'error', message: 'APIキーの再発行に失敗しました' });
      setRegeneratingId(null);
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <>
      <motion.div
        className="space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Info box */}
        <motion.div variants={itemVariants}>
          <div className="rounded-xl bg-blue-950/30 border border-blue-700/30 p-4 text-sm text-blue-200">
            <p className="font-semibold mb-1">🔑 ツール認証について</p>
            <p className="text-xs text-blue-300/70">
              各ツールは固有のAPIキーで認証します。キーは発行時にのみ表示されます。
              再発行すると旧キーは即時無効化されます。
            </p>
          </div>
        </motion.div>

        {tools.length === 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <p className="text-sm text-gray-500 text-center py-4">
                ツールが登録されていません。
                <br />
                <a href="/tools" className="text-brand-400 hover:underline mt-1 inline-block">
                  ツール登録へ →
                </a>
              </p>
            </Card>
          </motion.div>
        )}

        {tools.map((tool) => (
          <motion.div key={tool.id} variants={itemVariants}>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-100">{tool.name}</h3>
                    <Badge status={tool.status} type="tool" />
                  </div>
                  <p className="text-xs text-gray-500 font-mono">{tool.identifier}</p>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* API Key prefix */}
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">APIキー (プレフィックス)</label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="text-xs bg-surface-900 rounded px-2 py-1.5 font-mono text-gray-300 flex-1">
                          {(tool as unknown as { api_key_prefix?: string }).api_key_prefix
                            ? `${(tool as unknown as { api_key_prefix: string }).api_key_prefix}••••••••••••••••••••••`
                            : '未発行'}
                        </code>
                      </div>
                    </div>

                    {/* Endpoint */}
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">エンドポイント</label>
                      <div className="mt-1">
                        <code className="text-xs bg-surface-900 rounded px-2 py-1.5 font-mono text-gray-300 block truncate">
                          {tool.endpoint_url || '—'}
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* Integration info */}
                  <div className="mt-3 p-2.5 rounded-lg bg-surface-900/60 border border-surface-700">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">使用方法</p>
                    <code className="text-[10px] text-gray-300 leading-relaxed block">
                      {`X-Tool-Api-Key: ${(tool as unknown as { api_key_prefix?: string }).api_key_prefix ?? 'hub_xxxx'}••••\nX-Tool-Identifier: ${tool.identifier}`}
                    </code>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRegeneratingId(tool.id);
                    }}
                  >
                    再発行
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Confirm regenerate modal */}
      <Modal
        isOpen={!!regeneratingId}
        onClose={() => setRegeneratingId(null)}
        title="APIキーの再発行"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-950/30 border border-red-700/30 p-3">
            <p className="text-sm text-red-200 font-semibold mb-1">⚠️ 旧キーは即時無効化されます</p>
            <p className="text-xs text-red-300/70">
              再発行すると、このツールの既存APIキーはすぐに使えなくなります。
              ツール側の設定も同時に更新してください。
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRegeneratingId(null)}>キャンセル</Button>
            <Button
              variant="danger"
              loading={regenerateMutation.isPending}
              onClick={() => regenerateMutation.mutate(regeneratingId!)}
            >
              再発行する
            </Button>
          </div>
        </div>
      </Modal>

      {/* New key display modal */}
      <AnimatePresence>
        {newKey && (
          <Modal isOpen onClose={() => setNewKey(null)} title="新しいAPIキーが発行されました" size="md">
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-950/30 border border-amber-700/40 p-3">
                <p className="text-sm text-amber-200 font-semibold mb-1">⚠️ このキーは一度しか表示されません</p>
                <p className="text-xs text-amber-300/70">安全な場所に保存してください。</p>
              </div>
              <div>
                <label className="text-xs text-gray-400">ツール: {newKey.toolName}</label>
              </div>
              <div>
                <label className="text-xs text-gray-400">新しいAPIキー</label>
                <div className="flex gap-2 mt-1">
                  <code className="flex-1 text-xs bg-surface-700 rounded px-2 py-1.5 font-mono text-gray-100 break-all">
                    {newKey.apiKey}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(newKey.apiKey);
                      addToast({ type: 'success', message: 'クリップボードにコピーしました' });
                    }}
                  >
                    コピー
                  </Button>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setNewKey(null)}>閉じる</Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function ProtocolDocs() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <motion.div
      className="space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <Card>
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Hub Workspace 連携プロトコル v1.0</h3>
          <p className="text-xs text-gray-400 mb-4">
            外部ツールは以下のAPIを通じてHubと連携します。すべてのリクエストに
            <code className="bg-surface-700 px-1 rounded text-gray-200 mx-1">X-Tool-Api-Key</code>
            ヘッダーが必要です。
          </p>

          <div className="space-y-6">
            <Section title="📥 プロジェクト情報を取得" method="GET" path={`${baseUrl}/api/integrations/projects/{integration_key}/context`}>
              <pre className="bg-surface-900 rounded p-3 overflow-x-auto text-[10px] leading-relaxed text-gray-300">{`Headers:
  X-Tool-Api-Key: hub_xxxxxxxxxxxx

Response:
{
  "success": true,
  "schema_version": "1.0.0",
  "data": {
    "project": {
      "id": "uuid",
      "name": "プロジェクト名",
      "description": "説明",
      "status": "active"
    },
    "client": {
      "name": "クライアント名",
      "industry": "業種"
    },
    "client_dna": [
      { "category": "ブランド", "content": "..." }
    ],
    "tasks": [
      {
        "id": "uuid",
        "title": "タスク名",
        "status": "in_progress",
        "due_date": "2024-12-31"
      }
    ]
  }
}`}</pre>
            </Section>

            <Section title="📤 成果物を送信" method="POST" path={`${baseUrl}/api/integrations/projects/{integration_key}/artifacts`}>
              <pre className="bg-surface-900 rounded p-3 overflow-x-auto text-[10px] leading-relaxed text-gray-300">{`Headers:
  X-Tool-Api-Key: hub_xxxxxxxxxxxx
  Content-Type: application/json

Body:
{
  "task_id": "uuid (任意)",
  "title": "完成したLP",
  "artifact_type": "url",       // file | url | text | image | json
  "url": "https://example.com/result",
  "content": "備考 (任意)",
  "metadata": { "version": "1.0" }
}

Response:
{
  "success": true,
  "data": { "id": "uuid", ... }
}`}</pre>
            </Section>

            <Section title="🔄 タスクステータスを更新" method="POST" path={`${baseUrl}/api/integrations/projects/{integration_key}/tasks/{task_id}/status`}>
              <pre className="bg-surface-900 rounded p-3 overflow-x-auto text-[10px] leading-relaxed text-gray-300">{`Headers:
  X-Tool-Api-Key: hub_xxxxxxxxxxxx
  Content-Type: application/json

Body:
{
  "status": "in_progress",   // in_progress | review | done
  "note": "作業完了しました (任意)"
}`}</pre>
            </Section>

            <Section title="💓 ヘルスチェック" method="GET" path={`${baseUrl}/api/integrations/health`}>
              <pre className="bg-surface-900 rounded p-3 overflow-x-auto text-[10px] leading-relaxed text-gray-300">{`// 認証不要

Response:
{
  "success": true,
  "data": { "status": "ok", "schema_version": "1.0.0" }
}`}</pre>
            </Section>

            <div className="bg-violet-950/30 border border-violet-700/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-200 mb-2">共通ルール</p>
              <ul className="space-y-1 text-[11px] text-violet-300/80 list-disc list-inside">
                <li>すべてのレスポンスは <code className="bg-surface-800 px-1 rounded">success</code>, <code className="bg-surface-800 px-1 rounded">schema_version: "1.0.0"</code>, <code className="bg-surface-800 px-1 rounded">data</code> を持つ</li>
                <li>エラー時: <code className="bg-surface-800 px-1 rounded">{`{ "success": false, "error": { "code": "...", "message": "..." } }`}</code></li>
                <li>日時はISO 8601 UTC形式、日付は <code className="bg-surface-800 px-1 rounded">YYYY-MM-DD</code></li>
                <li>APIキーは <code className="bg-surface-800 px-1 rounded">X-Tool-Api-Key</code> ヘッダーで送信</li>
              </ul>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* JSON Schema */}
      <motion.div variants={itemVariants}>
        <Card>
          <h3 className="text-sm font-semibold text-gray-200 mb-3">成果物 (Artifact) スキーマ</h3>
          <pre className="bg-surface-900 rounded p-3 overflow-x-auto text-[10px] leading-relaxed text-gray-300">{`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Artifact",
  "type": "object",
  "required": ["title", "artifact_type"],
  "properties": {
    "task_id":       { "type": "string", "format": "uuid", "description": "関連タスクID (任意)" },
    "title":         { "type": "string", "minLength": 1, "description": "成果物のタイトル" },
    "artifact_type": { "type": "string", "enum": ["file", "url", "text", "image", "json"] },
    "content":       { "type": "string", "description": "テキスト/JSONコンテンツ" },
    "url":           { "type": "string", "format": "uri", "description": "成果物URL" },
    "metadata":      { "type": "object", "description": "追加メタデータ (自由形式)" }
  }
}`}</pre>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function Section({
  title, method, path, children,
}: {
  title: string; method: string; path: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-surface-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-700/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              method === 'GET' ? 'bg-emerald-800 text-emerald-200' : 'bg-blue-800 text-blue-200'
            }`}
          >
            {method}
          </span>
          <span className="text-sm font-medium text-gray-200">{title}</span>
        </div>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              <code className="text-[10px] text-gray-500 block">{path}</code>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
