import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { toolsApi } from '../../lib/api';
import { useToastStore } from '../../stores/toastStore';

export function ToolRegistry() {
  const [formOpen, setFormOpen] = useState(false);
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await toolsApi.list();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const healthMutation = useMutation({
    mutationFn: (id: string) => toolsApi.healthCheck(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tools'] });
      if (res.data.success) {
        addToast({ type: 'success', message: `ヘルスチェック完了: ${res.data.data.status}` });
      }
    },
    onError: () => addToast({ type: 'error', message: 'ヘルスチェックに失敗しました' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => toolsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tools'] });
      addToast({ type: 'success', message: 'ツールを削除しました' });
    },
    onError: () => addToast({ type: 'error', message: '削除に失敗しました' }),
  });

  function handleDelete(id: string, name: string) {
    if (window.confirm(`「${name}」を削除します。よろしいですか？`)) {
      deleteMutation.mutate(id);
    }
  }

  function handleLaunch(url: string) {
    if (!url) {
      addToast({ type: 'error', message: 'エンドポイントURLが未設定です' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>＋ ツール登録</Button>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-100">{t.name}</h3>
                  <p className="text-xs text-gray-500">{t.identifier}</p>
                </div>
                <Badge status={t.status} type="tool" />
              </div>
              {t.description && (
                <p className="mt-2 text-sm text-gray-400">{t.description}</p>
              )}
              <dl className="mt-3 space-y-1 text-xs text-gray-500">
                <div className="flex justify-between"><dt>エンドポイント</dt><dd className="text-gray-300 truncate ml-2">{t.endpoint_url}</dd></div>
                <div className="flex justify-between"><dt>最終ヘルスチェック</dt><dd className="text-gray-300">{t.last_health_check ? format(parseISO(t.last_health_check), 'MM/dd HH:mm') : '—'}</dd></div>
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleLaunch(t.endpoint_url)}
                >
                  起動
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => healthMutation.mutate(t.id)}
                  loading={healthMutation.isPending && healthMutation.variables === t.id}
                >
                  ヘルスチェック
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(t.id, t.name)}
                loading={deleteMutation.isPending && deleteMutation.variables === t.id}
                className="mt-2 w-full text-red-400 hover:text-red-300"
              >
                削除
              </Button>
            </Card>
          ))}
          {tools.length === 0 && (
            <Card className="col-span-full"><p className="text-sm text-gray-500">ツールが登録されていません</p></Card>
          )}
        </div>
      )}

      <ToolForm isOpen={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function ToolForm({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [healthEndpoint, setHealthEndpoint] = useState('');
  const [capabilities, setCapabilities] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [createdToolIdentifier, setCreatedToolIdentifier] = useState<string | null>(null);

  function reset() {
    setIdentifier(''); setName(''); setDescription('');
    setEndpointUrl(''); setHealthEndpoint(''); setCapabilities('{}');
    setError(null); setCreatedApiKey(null); setCreatedToolIdentifier(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const mutation = useMutation({
    mutationFn: () => {
      let caps: Record<string, unknown>;
      try {
        caps = JSON.parse(capabilities);
      } catch {
        throw new Error('capabilities は有効なJSONである必要があります');
      }
      return toolsApi.create({
        identifier,
        name,
        description,
        endpoint_url: endpointUrl,
        health_endpoint: healthEndpoint,
        capabilities: caps,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tools'] });
      addToast({ type: 'success', message: 'ツールを登録しました' });
      if (res.data.success) {
        const data = res.data.data as unknown as { api_key?: string; identifier?: string };
        if (data.api_key) {
          setCreatedApiKey(data.api_key);
          setCreatedToolIdentifier(data.identifier ?? identifier);
          return;
        }
      }
      handleClose();
    },
    onError: (e: unknown) => {
      const axiosMsg = (e as { response?: { data?: { error?: { message?: string; details?: unknown } } } })
        ?.response?.data?.error;
      if (axiosMsg?.details && Array.isArray(axiosMsg.details)) {
        const msgs = (axiosMsg.details as { message: string }[]).map((d) => d.message).join('、');
        setError(msgs);
      } else if (axiosMsg?.message) {
        setError(axiosMsg.message);
      } else {
        setError(e instanceof Error ? e.message : '登録に失敗しました');
      }
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  if (createdApiKey) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="APIキーが発行されました" size="md">
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-950/30 border border-amber-700/40 p-3">
            <p className="text-sm text-amber-200 font-semibold mb-1">
              ⚠️ このキーは一度しか表示されません
            </p>
            <p className="text-xs text-amber-300/70">
              必ず安全な場所（パスワード管理ツールなど）に保存してください。
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-400">ツール識別子</label>
            <code className="block mt-1 text-sm bg-surface-700 rounded px-2 py-1.5 font-mono text-gray-100">
              {createdToolIdentifier}
            </code>
          </div>
          <div>
            <label className="text-xs text-gray-400">APIキー</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 text-xs bg-surface-700 rounded px-2 py-1.5 font-mono text-gray-100 break-all">
                {createdApiKey}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(createdApiKey);
                  addToast({ type: 'success', message: 'クリップボードにコピーしました' });
                }}
              >
                コピー
              </Button>
            </div>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p>このキーを使って、外部ツールから以下のヘッダーで認証できます：</p>
            <code className="block bg-surface-700 rounded px-2 py-1 text-gray-200">
              X-Tool-Api-Key: {createdApiKey.slice(0, 12)}...
            </code>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>閉じる</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="ツール登録" size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="識別子 *" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="例: prompt_builder" required helper="半角英小文字とアンダースコアのみ" />
        <Input label="表示名 *" value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea label="説明" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <Input label="エンドポイントURL *" value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://your-tool.example.com" required helper="ツールのAPIエンドポイント（未使用の場合は https://example.com など仮URLでも可）" />
        <Input label="ヘルスチェックURL *" value={healthEndpoint} onChange={(e) => setHealthEndpoint(e.target.value)} placeholder="https://your-tool.example.com/health" required helper="ツールの死活監視URL（仮の場合は https://example.com/health など）" />
        <Textarea
          label="Capabilities (JSON)"
          value={capabilities}
          onChange={(e) => setCapabilities(e.target.value)}
          rows={4}
          helper="ツールの機能定義をJSON形式で記述"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>キャンセル</Button>
          <Button type="submit" loading={mutation.isPending}>登録</Button>
        </div>
      </form>
    </Modal>
  );
}
