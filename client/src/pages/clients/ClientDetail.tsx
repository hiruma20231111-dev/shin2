import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Spinner } from '../../components/ui/Spinner';
import { clientsApi, projectsApi, invoicesApi, activityApi } from '../../lib/api';
import { ClientForm } from './ClientForm';
import { useToastStore } from '../../stores/toastStore';
import type { ClientDNA } from '../../types';

type Tab = 'overview' | 'projects' | 'billing' | 'activity';

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const res = await clientsApi.get(id!);
      if (!res.data.success) throw new Error('Not found');
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: dna = [] } = useQuery({
    queryKey: ['client-dna', id],
    queryFn: async () => {
      const res = await clientsApi.getDna(id!);
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['client-projects', id],
    queryFn: async () => {
      const res = await projectsApi.list({ client_id: id, limit: 100 });
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['client-invoices', id],
    queryFn: async () => {
      const res = await invoicesApi.list({ client_id: id, limit: 100 });
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ['client-activity', id],
    queryFn: async () => {
      const res = await activityApi.getForClient(id!);
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled: !!id && tab === 'activity',
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!client) return <Card><p className="text-red-400">クライアントが見つかりません</p></Card>;

  const totalInvoiced = invoices.reduce((acc, i) => acc + (i.status === 'paid' ? Number(i.amount) : 0), 0);
  const totalDraft = invoices.reduce((acc, i) => acc + (i.status === 'draft' ? Number(i.amount) : 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{client.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            <Badge status={client.status} type="client" />
            <span>{client.industry}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setEditOpen(true)}>編集</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-700">
        {([
          { key: 'overview', label: '概要・DNA' },
          { key: 'projects', label: 'プロジェクト' },
          { key: 'billing', label: '売上' },
          { key: 'activity', label: '活動ログ' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">基本情報</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-gray-400">メール</dt><dd className="text-gray-100">{client.contact_email ?? '—'}</dd></div>
              <div><dt className="text-xs text-gray-400">電話</dt><dd className="text-gray-100">{client.contact_phone ?? '—'}</dd></div>
              <div><dt className="text-xs text-gray-400">メモ</dt><dd className="text-gray-100 whitespace-pre-wrap">{client.notes ?? '—'}</dd></div>
              <div><dt className="text-xs text-gray-400">タグ</dt><dd className="text-gray-100">{client.tags?.join(', ') ?? '—'}</dd></div>
            </dl>
          </Card>
          <DnaPanel clientId={client.id} dna={dna} onChanged={() => qc.invalidateQueries({ queryKey: ['client-dna', id] })} addToast={addToast} />
        </div>
      )}

      {tab === 'projects' && (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead className="bg-surface-900/60 text-xs text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">プロジェクト名</th>
                <th className="text-left px-4 py-3">ステータス</th>
                <th className="text-left px-4 py-3">期間</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-surface-700 hover:bg-surface-700/40">
                  <td className="px-4 py-3">
                    <Link to={`/projects/${p.id}`} className="text-gray-100 hover:text-brand-300">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><Badge status={p.status} type="project" /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {p.start_date ?? '—'} ～ {p.end_date ?? '—'}
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">プロジェクトがありません</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'billing' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <Card><div className="text-xs text-gray-400">支払済み合計</div><div className="text-2xl font-bold text-gray-100">¥{totalInvoiced.toLocaleString()}</div></Card>
            <Card><div className="text-xs text-gray-400">下書き合計</div><div className="text-2xl font-bold text-gray-100">¥{totalDraft.toLocaleString()}</div></Card>
            <Card><div className="text-xs text-gray-400">請求書数</div><div className="text-2xl font-bold text-gray-100">{invoices.length}</div></Card>
          </div>
          <Card padding="none">
            <table className="w-full text-sm">
              <thead className="bg-surface-900/60 text-xs text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">件名</th>
                  <th className="text-left px-4 py-3">金額</th>
                  <th className="text-left px-4 py-3">ステータス</th>
                  <th className="text-left px-4 py-3">発行日</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-t border-surface-700">
                    <td className="px-4 py-3 text-gray-100">{i.title}</td>
                    <td className="px-4 py-3 text-gray-200">¥{Number(i.amount).toLocaleString()}</td>
                    <td className="px-4 py-3"><Badge status={i.status} type="invoice" /></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{i.issue_date}</td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">請求書がありません</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'activity' && (
        <Card>
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 text-sm border-b border-surface-800 pb-2">
                <span className="text-xs text-gray-500 w-32 shrink-0">
                  {format(parseISO(a.created_at), 'yyyy/MM/dd HH:mm')}
                </span>
                <span className="text-gray-200">{a.action}</span>
                <span className="text-xs text-gray-500">{a.entity_type}</span>
              </li>
            ))}
            {activity.length === 0 && (
              <li className="text-sm text-gray-500">アクティビティがありません</li>
            )}
          </ul>
        </Card>
      )}

      <ClientForm isOpen={editOpen} onClose={() => setEditOpen(false)} editing={client} />
    </div>
  );
}

// ── DNA panel ──────────────────────────────────────────────────
function DnaPanel({
  clientId,
  dna,
  onChanged,
  addToast,
}: {
  clientId: string;
  dna: ClientDNA[];
  onChanged: () => void;
  addToast: (t: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) => void;
}) {
  const [category, setCategory] = useState('性格');
  const [content, setContent] = useState('');

  const addMutation = useMutation({
    mutationFn: () => clientsApi.addDna(clientId, { category, content }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'DNA項目を追加しました' });
      setContent('');
      onChanged();
    },
    onError: () => addToast({ type: 'error', message: 'DNA追加に失敗しました' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (dnaId: string) => clientsApi.deleteDna(clientId, dnaId),
    onSuccess: () => {
      addToast({ type: 'success', message: 'DNA項目を削除しました' });
      onChanged();
    },
  });

  return (
    <Card className="lg:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">クライアントDNA</h3>
        <span className="text-xs text-gray-500">タスク実行時に関連項目をClaude APIが要約します</span>
      </div>

      <ul className="space-y-2 max-h-72 overflow-y-auto mb-4">
        {dna.map((d) => (
          <li key={d.id} className="flex items-start gap-3 border-b border-surface-800 pb-2">
            <span className="text-xs px-2 py-0.5 rounded bg-brand-600/20 text-brand-300 shrink-0">
              {d.category}
            </span>
            <p className="flex-1 text-sm text-gray-200 whitespace-pre-wrap">{d.content}</p>
            <button
              type="button"
              className="text-xs text-red-400 hover:text-red-300"
              onClick={() => deleteMutation.mutate(d.id)}
            >
              削除
            </button>
          </li>
        ))}
        {dna.length === 0 && (
          <li className="text-sm text-gray-500">DNA項目がありません</li>
        )}
      </ul>

      <div className="space-y-2 border-t border-surface-700 pt-3">
        <div className="flex gap-2">
          <Input
            label="カテゴリ"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-40"
          />
          <div className="flex-1">
            <Textarea
              label="内容"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => addMutation.mutate()}
            loading={addMutation.isPending}
            disabled={!content.trim()}
            size="sm"
          >
            DNA項目を追加
          </Button>
        </div>
      </div>
    </Card>
  );
}
