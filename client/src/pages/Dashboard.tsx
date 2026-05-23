import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { dashboardApi } from '../lib/api';
import { AdvisorPanel } from '../components/ai/AdvisorPanel';

function fmtYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

export function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await dashboardApi.get();
      if (!res.data.success) throw new Error('Failed to fetch dashboard');
      return res.data.data;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (error || !data) return <Card><p className="text-red-400">ダッシュボードデータの取得に失敗しました</p></Card>;

  const onlineCount = data.toolStatuses.filter((t) => t.status === 'online').length;

  return (
    <div className="space-y-6">
      <AdvisorPanel
        endpoint="/ai/dashboard-summary"
        title="進捗サマリー & 推奨アクション"
        queryKey={['ai', 'dashboard-summary']}
      />

      {/* Stat row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs text-gray-400">今週のタスク</div>
          <div className="mt-1 text-3xl font-bold text-gray-100">{data.thisWeekTasks.length}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-400">進行中プロジェクト</div>
          <div className="mt-1 text-3xl font-bold text-gray-100">{data.activeProjectsCount}</div>
          <div className="mt-1 text-xs text-gray-500">完了率 {data.projectCompletionRate}%</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-400">今月の売上</div>
          <div className="mt-1 text-3xl font-bold text-gray-100">{fmtYen(data.monthlyRevenue.total)}</div>
          <div className="mt-1 text-xs text-gray-500">
            未請求 {fmtYen(data.monthlyRevenue.uninvoiced)}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-gray-400">ツール稼働中</div>
          <div className="mt-1 text-3xl font-bold text-gray-100">
            {onlineCount} / {data.toolStatuses.length}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* This week tasks */}
        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">今週のタスク</h3>
          {data.thisWeekTasks.length === 0 ? (
            <p className="text-sm text-gray-500">今週の予定タスクはありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-surface-700">
                    <th className="text-left py-2">タスク</th>
                    <th className="text-left py-2">優先度</th>
                    <th className="text-left py-2">ステータス</th>
                    <th className="text-left py-2">期日</th>
                  </tr>
                </thead>
                <tbody>
                  {data.thisWeekTasks.slice(0, 15).map((t) => (
                    <tr key={t.id} className="border-b border-surface-800 hover:bg-surface-700/40">
                      <td className="py-2">
                        <Link to={`/tasks/${t.id}`} className="text-gray-100 hover:text-brand-300">
                          {t.title}
                        </Link>
                      </td>
                      <td className="py-2"><Badge status={t.priority} type="priority" /></td>
                      <td className="py-2"><Badge status={t.status} type="task" /></td>
                      <td className="py-2 text-gray-400">
                        {t.due_date ? format(parseISO(t.due_date), 'MM/dd') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Tool statuses */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-200 mb-3">ツール稼働状況</h3>
          <ul className="space-y-2">
            {data.toolStatuses.map((t) => (
              <li key={t.identifier} className="flex items-center justify-between text-sm">
                <span className="text-gray-200">{t.name}</span>
                <Badge status={t.status} type="tool" />
              </li>
            ))}
            {data.toolStatuses.length === 0 && (
              <li className="text-xs text-gray-500">登録されたツールはありません</li>
            )}
          </ul>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">最近のアクティビティ</h3>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">アクティビティはありません</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 text-sm border-b border-surface-800 pb-2">
                <span className="text-xs text-gray-500 w-32 shrink-0">
                  {format(parseISO(a.created_at), 'MM/dd HH:mm')}
                </span>
                <span className="text-gray-200">{a.action}</span>
                <span className="text-xs text-gray-500">{a.entity_type}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
