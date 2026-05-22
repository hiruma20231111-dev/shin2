import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { activityApi } from '../../lib/api';

export function ActivityLogPage() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['activity', { entityType, page }],
    queryFn: async () => {
      const res = await activityApi.list({
        entity_type: entityType || undefined,
        page,
        limit: 50,
      });
      if (!res.data.success) throw new Error('Failed');
      return res.data;
    },
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <Select
          label="エンティティ種別"
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          options={[
            { value: '', label: 'すべて' },
            { value: 'client', label: 'クライアント' },
            { value: 'project', label: 'プロジェクト' },
            { value: 'task', label: 'タスク' },
            { value: 'tool', label: 'ツール' },
            { value: 'client_dna', label: 'DNA' },
            { value: 'invoice', label: '請求書' },
          ]}
          className="w-56"
        />
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {!isLoading && (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead className="bg-surface-900/60 text-xs text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">日時</th>
                <th className="text-left px-4 py-3">アクション</th>
                <th className="text-left px-4 py-3">種別</th>
                <th className="text-left px-4 py-3">エンティティID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((a) => (
                <tr key={a.id} className="border-t border-surface-700">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                    {format(parseISO(a.created_at), 'yyyy/MM/dd HH:mm:ss')}
                  </td>
                  <td className="px-4 py-3 text-gray-100">{a.action}</td>
                  <td className="px-4 py-3 text-xs text-gray-300">{a.entity_type}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{a.entity_id.slice(0, 8)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">ログがありません</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>前へ</Button>
          <span className="text-xs text-gray-400">{page} / {totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>次へ</Button>
        </div>
      )}
    </div>
  );
}
