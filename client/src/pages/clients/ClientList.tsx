import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { clientsApi } from '../../lib/api';
import { ClientForm } from './ClientForm';

type ViewMode = 'card' | 'list';

export function ClientList() {
  const [view, setView] = useState<ViewMode>('card');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, statusFilter, industryFilter }],
    queryFn: async () => {
      const res = await clientsApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        industry: industryFilter || undefined,
        limit: 200,
      });
      if (!res.data.success) throw new Error('Failed');
      return res.data;
    },
  });

  const clients = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="検索"
          placeholder="名前・業種で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select
          label="ステータス"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'すべて' },
            { value: 'active', label: '稼働中' },
            { value: 'paused', label: '一時停止' },
            { value: 'inactive', label: '停止' },
          ]}
          className="w-40"
        />
        <Input
          label="業種"
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="w-40"
        />

        <div className="flex-1" />

        <div className="flex border border-surface-600 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setView('card')}
            className={`px-3 py-2 text-sm ${view === 'card' ? 'bg-brand-600 text-white' : 'text-gray-300'}`}
          >
            カード
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-3 py-2 text-sm ${view === 'list' ? 'bg-brand-600 text-white' : 'text-gray-300'}`}
          >
            リスト
          </button>
        </div>

        <Button onClick={() => setFormOpen(true)}>＋ 新規クライアント</Button>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {!isLoading && clients.length === 0 && (
        <Card><p className="text-gray-500 text-sm">クライアントがありません</p></Card>
      )}

      {!isLoading && view === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Link key={c.id} to={`/clients/${c.id}`}>
              <Card className="hover:border-brand-500 transition-colors h-full">
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-gray-100">{c.name}</h3>
                  <Badge status={c.status} type="client" />
                </div>
                <p className="mt-1 text-sm text-gray-400">{c.industry}</p>
                {c.tags && c.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded bg-surface-700 text-gray-300">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-500">
                  更新: {format(parseISO(c.updated_at), 'yyyy/MM/dd')}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && view === 'list' && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-900/60 text-xs text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">名前</th>
                  <th className="text-left px-4 py-3">業種</th>
                  <th className="text-left px-4 py-3">ステータス</th>
                  <th className="text-left px-4 py-3">タグ</th>
                  <th className="text-left px-4 py-3">更新日</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-surface-700 hover:bg-surface-700/40 cursor-pointer"
                    onClick={() => window.location.assign(`/clients/${c.id}`)}
                  >
                    <td className="px-4 py-3 text-gray-100">{c.name}</td>
                    <td className="px-4 py-3 text-gray-300">{c.industry}</td>
                    <td className="px-4 py-3"><Badge status={c.status} type="client" /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{c.tags?.join(', ') ?? ''}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {format(parseISO(c.updated_at), 'yyyy/MM/dd')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ClientForm isOpen={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}
