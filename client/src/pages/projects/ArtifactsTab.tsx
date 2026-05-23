import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { artifactsApi, toolsApi, type Artifact } from '../../lib/api';
import { useToastStore } from '../../stores/toastStore';

type ArtifactType = 'file' | 'url' | 'text' | 'image' | 'json';

const TYPE_LABEL: Record<ArtifactType, string> = {
  file: 'ファイル',
  url: 'URL',
  text: 'テキスト',
  image: '画像',
  json: 'JSON',
};

const TYPE_ICON: Record<ArtifactType, string> = {
  file: '📄',
  url: '🔗',
  text: '📝',
  image: '🖼️',
  json: '⚙️',
};

export function ArtifactsTab({ projectId }: { projectId: string }) {
  const [formOpen, setFormOpen] = useState(false);
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: ['artifacts', projectId],
    queryFn: async () => {
      const res = await artifactsApi.list(projectId);
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => artifactsApi.delete(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['artifacts', projectId] });
      addToast({ type: 'success', message: '成果物を削除しました' });
    },
    onError: () => addToast({ type: 'error', message: '削除に失敗しました' }),
  });

  function handleDelete(id: string, title: string) {
    if (window.confirm(`「${title}」を削除します。よろしいですか？`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          プロジェクトの成果物（ツール出力、参照URL、納品ファイルなど）を記録します
        </p>
        <Button size="sm" onClick={() => setFormOpen(true)}>＋ 成果物を追加</Button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Spinner size="lg" /></div>}

      {!isLoading && artifacts.length === 0 && (
        <Card>
          <p className="text-sm text-gray-500 text-center py-4">
            成果物がまだ登録されていません。「成果物を追加」から最初の成果物を記録しましょう。
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {artifacts.map((a) => (
          <ArtifactCard
            key={a.id}
            artifact={a}
            onDelete={() => handleDelete(a.id, a.title)}
            deleting={deleteMutation.isPending && deleteMutation.variables === a.id}
          />
        ))}
      </div>

      <ArtifactForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}

function ArtifactCard({
  artifact,
  onDelete,
  deleting,
}: {
  artifact: Artifact;
  onDelete: () => void;
  deleting: boolean;
}) {
  const type = artifact.artifact_type as ArtifactType;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span>{TYPE_ICON[type]}</span>
            <span className="text-xs text-gray-500 font-mono">{TYPE_LABEL[type]}</span>
            {artifact.tool_identifier && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">
                {artifact.tool_identifier}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-gray-100 truncate">{artifact.title}</h4>
          {artifact.url && (
            <a
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-400 hover:text-brand-300 truncate block mt-1"
            >
              {artifact.url}
            </a>
          )}
          {artifact.content && type !== 'url' && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-3 whitespace-pre-wrap">
              {artifact.content}
            </p>
          )}
          <div className="text-[10px] text-gray-500 mt-2">
            {format(parseISO(artifact.created_at), 'yyyy/MM/dd HH:mm')}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          loading={deleting}
          className="text-red-400 hover:text-red-300"
        >
          ✕
        </Button>
      </div>
      {artifact.url && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-2 w-full"
          onClick={() => window.open(artifact.url!, '_blank', 'noopener,noreferrer')}
        >
          開く
        </Button>
      )}
    </Card>
  );
}

function ArtifactForm({
  isOpen,
  onClose,
  projectId,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ArtifactType>('url');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [toolIdentifier, setToolIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: tools = [] } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await toolsApi.list();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: () =>
      artifactsApi.create(projectId, {
        title,
        artifact_type: type,
        url: url || null,
        content: content || null,
        tool_identifier: toolIdentifier || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['artifacts', projectId] });
      addToast({ type: 'success', message: '成果物を登録しました' });
      onClose();
      setTitle(''); setUrl(''); setContent(''); setToolIdentifier(''); setType('url');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg ?? '登録に失敗しました');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url && !content) {
      setError('URL または内容のどちらか一方は必須です');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="成果物の登録" size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="タイトル *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 完成LPのデモURL、初稿コピー、参考資料"
          required
        />
        <Select
          label="種別"
          value={type}
          onChange={(e) => setType(e.target.value as ArtifactType)}
          options={[
            { value: 'url', label: '🔗 URL（外部リンク・デモページ）' },
            { value: 'file', label: '📄 ファイル（ファイルURL）' },
            { value: 'image', label: '🖼️ 画像' },
            { value: 'text', label: '📝 テキスト（コピー、メモなど）' },
            { value: 'json', label: '⚙️ JSON（設定・データ）' },
          ]}
        />
        {type !== 'text' && (
          <Input
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        )}
        <Textarea
          label={type === 'text' ? '内容 *' : '備考・内容'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={type === 'text' ? 8 : 3}
        />
        <Select
          label="関連ツール（任意）"
          value={toolIdentifier}
          onChange={(e) => setToolIdentifier(e.target.value)}
          options={[
            { value: '', label: '— なし —' },
            ...tools.map((t) => ({
              value: t.identifier,
              label: `${t.name}（${t.identifier}）`,
            })),
          ]}
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
