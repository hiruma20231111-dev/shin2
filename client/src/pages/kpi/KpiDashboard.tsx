import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { dashboardApi } from '../../lib/api';

const REVENUE_TARGET = 1_000_000;

const PROJECT_COLORS: Record<string, string> = {
  planning: '#6b7280',
  active: '#3b82f6',
  review: '#f59e0b',
  completed: '#10b981',
  cancelled: '#ef4444',
};
const PROJECT_LABELS: Record<string, string> = {
  planning: '計画中', active: '進行中', review: 'レビュー',
  completed: '完了', cancelled: 'キャンセル',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#64748b',
};
const PRIORITY_LABELS: Record<string, string> = {
  critical: '緊急', high: '高', medium: '中', low: '低',
};

function fmtYen(n: number) {
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `¥${Math.round(n / 10_000)}万`;
  return `¥${n.toLocaleString('ja-JP')}`;
}

function fmtMonth(m: string) {
  const [, month] = m.split('-');
  return `${parseInt(month, 10)}月`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export function KpiDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi'],
    queryFn: async () => {
      const res = await dashboardApi.kpi();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    refetchInterval: 120_000,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error || !data) return <Card><p className="text-red-400">KPIデータの取得に失敗しました</p></Card>;

  const latestMonth = data.revenueHistory.at(-1);
  const latestRevenue = latestMonth?.revenue ?? 0;
  const revenueProgress = Math.min((latestRevenue / REVENUE_TARGET) * 100, 100);

  const totalTasksDone = data.taskBreakdown.reduce((s, r) => s + r.done, 0);
  const totalTasks = data.taskBreakdown.reduce((s, r) => s + r.count, 0);
  const taskCompletion = totalTasks > 0 ? Math.round((totalTasksDone / totalTasks) * 100) : 0;

  const latestVelocity = data.taskVelocity.at(-1)?.completed ?? 0;

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-gray-100">KPI ダッシュボード</h1>
        <p className="text-sm text-gray-400 mt-0.5">目標: 月次売上 ¥1,000,000</p>
      </motion.div>

      {/* KPI cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Revenue progress */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
          <div className="text-xs text-gray-400 mb-1">今月の売上</div>
          <div className="text-3xl font-bold text-gray-100">{fmtYen(latestRevenue)}</div>
          <div className="text-xs text-gray-500 mt-0.5">目標 {fmtYen(REVENUE_TARGET)}</div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>進捗</span>
              <span>{revenueProgress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${revenueProgress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
          </div>
        </Card>

        {/* Task completion */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
          <div className="text-xs text-gray-400 mb-1">タスク完了率</div>
          <div className="text-3xl font-bold text-gray-100">{taskCompletion}%</div>
          <div className="text-xs text-gray-500 mt-0.5">{totalTasksDone} / {totalTasks} 件完了</div>
          <div className="mt-3">
            <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${taskCompletion}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
          </div>
        </Card>

        {/* Weekly velocity */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
          <div className="text-xs text-gray-400 mb-1">今週の完了タスク</div>
          <div className="text-3xl font-bold text-gray-100">{latestVelocity}</div>
          <div className="text-xs text-gray-500 mt-0.5">件 / 週</div>
          <div className="mt-3 text-xs text-gray-500">
            過去4週間の平均:{' '}
            {data.taskVelocity.length > 0
              ? (data.taskVelocity.reduce((s, r) => s + r.completed, 0) / data.taskVelocity.length).toFixed(1)
              : 0}{' '}
            件/週
          </div>
        </Card>
      </motion.div>

      {/* Revenue chart */}
      <motion.div variants={itemVariants}>
        <Card>
          <h3 className="text-sm font-semibold text-gray-200 mb-4">売上推移 (過去6ヶ月)</h3>
          {data.revenueHistory.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">請求データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.revenueHistory} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tickFormatter={fmtYen} tick={{ fill: '#94a3b8', fontSize: 10 }} width={60} />
                <Tooltip content={<CustomTooltip formatter={fmtYen} />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {/* Target line */}
                <Line
                  type="monotone" dataKey={() => REVENUE_TARGET}
                  name="目標" stroke="#10b981" strokeDasharray="6 3"
                  strokeWidth={1.5} dot={false}
                />
                <Line
                  type="monotone" dataKey="revenue"
                  name="売上" stroke="#6366f1"
                  strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone" dataKey="paid"
                  name="入金済" stroke="#22d3ee"
                  strokeWidth={2} dot={{ fill: '#22d3ee', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task velocity */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-200 mb-4">タスク速度 (週次)</h3>
          {data.taskVelocity.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">データがありません</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.taskVelocity} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(v: string) => v.slice(5)}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="completed" name="完了" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="created" name="作成" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Project breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-200 mb-4">プロジェクト状況</h3>
          {data.projectBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">プロジェクトがありません</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={data.projectBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={70}
                    paddingAngle={3}
                  >
                    {data.projectBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={PROJECT_COLORS[entry.status] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      return (
                        <div className="bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-xs shadow-xl">
                          <p style={{ color: p.payload.fill }}>{PROJECT_LABELS[p.name as string] ?? p.name}: {p.value}</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 text-xs">
                {data.projectBreakdown.map((entry) => (
                  <div key={entry.status} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: PROJECT_COLORS[entry.status] ?? '#6b7280' }}
                    />
                    <span className="text-gray-300">{PROJECT_LABELS[entry.status] ?? entry.status}</span>
                    <span className="text-gray-500 ml-auto">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Task priority breakdown */}
      <motion.div variants={itemVariants}>
        <Card>
          <h3 className="text-sm font-semibold text-gray-200 mb-4">優先度別タスク完了率</h3>
          {data.taskBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500">タスクがありません</p>
          ) : (
            <div className="space-y-3">
              {data.taskBreakdown.map((row) => {
                const pct = row.count > 0 ? Math.round((row.done / row.count) * 100) : 0;
                return (
                  <div key={row.priority} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: PRIORITY_COLORS[row.priority] }}>
                        {PRIORITY_LABELS[row.priority] ?? row.priority}
                      </span>
                      <span className="text-gray-400">{row.done}/{row.count}件 ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: PRIORITY_COLORS[row.priority] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Tool utilization */}
      {data.toolUtilization.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <h3 className="text-sm font-semibold text-gray-200 mb-4">ツール別タスク処理</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={data.toolUtilization}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 80, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis dataKey="tool" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="done" name="完了" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="total" name="合計" stackId="b" fill="#3b82f6" opacity={0.4} radius={[3, 3, 3, 3]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
