import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  const logContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => logContainerRef.current,
    estimateSize: () => 41,
    overscan: 10,
  });

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
          {/* Fixed header */}
          <table className="w-full text-sm">
            <thead className="bg-surface-900/60 text-xs text-gray-400">
              <tr>
                <th className="text-left px-4 py-3 w-44">日時</th>
                <th className="text-left px-4 py-3">アクション</th>
                <th className="text-left px-4 py-3 w-28">種別</th>
                <th className="text-left px-4 py-3 w-28">エンティティID</th>
              </tr>
            </thead>
          </table>
          {logs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">ログがありません</p>
          ) : (
            <div
              ref={logContainerRef}
              className="overflow-y-auto"
              style={{ maxHeight: '65vh' }}
            >
              <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const a = logs[virtualRow.index];
                  return (
                    <div
                      key={a.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="flex border-t border-surface-700 text-sm"
                    >
                      <div className="px-4 py-3 text-xs text-gray-400 font-mono w-44 shrink-0">
                        {format(parseISO(a.created_at), 'yyyy/MM/dd HH:mm:ss')}
                      </div>
                      <div className="px-4 py-3 text-gray-100 flex-1">{a.action}</div>
                      <div className="px-4 py-3 text-xs text-gray-300 w-28 shrink-0">{a.entity_type}</div>
                      <div className="px-4 py-3 text-xs text-gray-500 font-mono w-28 shrink-0">
                        {a.entity_id.slice(0, 8)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
