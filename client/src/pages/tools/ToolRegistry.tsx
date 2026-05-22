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
              <Button
                size="sm"
                variant="secondary"
                onClick={() => healthMutation.mutate(t.id)}
                loading={healthMutation.isPending && healthMutation.variables === t.id}
                className="mt-3 w-full"
              >
                ヘルスチェック実行
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tools'] });
      addToast({ type: 'success', message: 'ツールを登録しました' });
      onClose();
      setIdentifier(''); setName(''); setDescription('');
      setEndpointUrl(''); setHealthEndpoint(''); setCapabilities('{}');
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : '登録に失敗しました');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ツール登録" size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="識別子 *" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="例: prompt_builder" required helper="半角英小文字とアンダースコアのみ" />
        <Input label="表示名 *" value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea label="説明" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <Input label="エンドポイントURL *" value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://..." required />
        <Input label="ヘルスチェックURL *" value={healthEndpoint} onChange={(e) => setHealthEndpoint(e.target.value)} placeholder="https://.../health" required />
        <Textarea
          label="Capabilities (JSON)"
          value={capabilities}
          onChange={(e) => setCapabilities(e.target.value)}
          rows={4}
          helper="ツールの機能定義をJSON形式で記述"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button type="submit" loading={mutation.isPending}>登録</Button>
        </div>
      </form>
    </Modal>
  );
}
