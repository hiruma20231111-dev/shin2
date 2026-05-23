import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { dashboardApi, type ResourceTask } from '../../lib/api';

const PRIORITY_TRACK: Record<string, string> = {
  critical: 'bg-red-500/70',
  high: 'bg-orange-500/70',
  medium: 'bg-blue-500/70',
  low: 'bg-slate-500/70',
};

export function ResourcePlanningPage() {
  const [view, setView] = useState<'tool' | 'timeline'>('tool');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const res = await dashboardApi.resources();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const byTool = useMemo(() => {
    const map: Record<string, ResourceTask[]> = {};
    for (const task of tasks) {
      const key = task.assigned_tool ?? '未割り当て';
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [tasks]);

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">リソース計画</h1>
          <p className="text-sm text-gray-400 mt-0.5">ツール別・期間別のタスク割り当て</p>
        </div>
        <div className="flex rounded-lg border border-surface-600 overflow-hidden">
          {(['tool', 'timeline'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                view === v
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700'
              }`}
            >
              {v === 'tool' ? 'ツール別' : 'タイムライン'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {!isLoading && view === 'tool' && <ToolView byTool={byTool} />}
      {!isLoading && view === 'timeline' && (
        <TimelineView tasks={tasks} monthDays={monthDays} monthStart={monthStart} monthEnd={monthEnd} />
      )}
    </div>
  );
}

function ToolView({ byTool }: { byTool: [string, ResourceTask[]][] }) {
  if (byTool.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 text-center py-4">
          進行中のタスクがありません
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="text-xs text-gray-400">未完了タスク</div>
          <div className="text-2xl font-bold text-gray-100 mt-0.5">
            {byTool.reduce((s, [, t]) => s + t.length, 0)}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-gray-400">割り当て済みツール</div>
          <div className="text-2xl font-bold text-gray-100 mt-0.5">
            {byTool.filter(([k]) => k !== '未割り当て').length}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-gray-400">未割り当てタスク</div>
          <div className="text-2xl font-bold text-gray-100 mt-0.5">
            {byTool.find(([k]) => k === '未割り当て')?.[1].length ?? 0}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-xs text-gray-400">緊急タスク</div>
          <div className="text-2xl font-bold text-red-400 mt-0.5">
            {byTool.reduce((s, [, t]) => s + t.filter((x) => x.priority === 'critical').length, 0)}
          </div>
        </Card>
      </div>

      {byTool.map(([toolId, toolTasks]) => (
        <motion.div
          key={toolId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">{toolId === '未割り当て' ? '📋' : '⚙'}</span>
                <h3 className="text-sm font-semibold text-gray-200">{toolId}</h3>
                <span className="text-xs text-gray-500">({toolTasks.length}件)</span>
              </div>
              <div className="flex gap-1">
                {['critical', 'high', 'medium', 'low'].map((p) => {
                  const count = toolTasks.filter((t) => t.priority === p).length;
                  if (count === 0) return null;
                  return (
                    <span
                      key={p}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_TRACK[p]} text-white`}
                    >
                      {{ critical: '緊急', high: '高', medium: '中', low: '低' }[p]}×{count}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              {toolTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-900/50 hover:bg-surface-700/50 transition-colors"
                >
                  <Badge status={task.status} type="task" />
                  <Link
                    to={`/tasks/${task.id}`}
                    className="flex-1 text-sm text-gray-200 hover:text-brand-300 truncate"
                  >
                    {task.title}
                  </Link>
                  <span className="text-xs text-gray-500 shrink-0">{task.project_name}</span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {task.due_date ? `締切 ${format(parseISO(task.due_date), 'M/d')}` : '期日未定'}
                  </span>
                  <Badge status={task.priority} type="priority" />
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function TimelineView({
  tasks,
  monthDays,
  monthStart,
  monthEnd,
}: {
  tasks: ResourceTask[];
  monthDays: Date[];
  monthStart: Date;
  monthEnd: Date;
}) {
  const today = new Date();
  const totalDays = differenceInDays(monthEnd, monthStart) + 1;

  const byProject = useMemo(() => {
    const map: Record<string, { name: string; client: string; tasks: ResourceTask[] }> = {};
    for (const task of tasks) {
      if (!map[task.project_id]) {
        map[task.project_id] = { name: task.project_name, client: task.client_name, tasks: [] };
      }
      map[task.project_id].tasks.push(task);
    }
    return Object.values(map);
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500 text-center py-4">
          タイムラインに表示するタスクがありません
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Month header with day markers */}
          <div className="flex border-b border-surface-700 bg-surface-900/60">
            <div className="w-48 shrink-0 px-4 py-2 text-xs font-semibold text-gray-400 border-r border-surface-700">
              プロジェクト
            </div>
            <div className="flex-1 relative h-8">
              {monthDays.map((day, i) => {
                const dow = day.getDay();
                return (
                  <div
                    key={i}
                    className={`absolute top-0 bottom-0 text-[9px] flex items-center justify-center border-r border-surface-800 ${
                      dow === 0 || dow === 6 ? 'bg-surface-900' : ''
                    } ${format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') ? 'bg-brand-900/30' : ''}`}
                    style={{ left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
                  >
                    <span className={dow === 0 || dow === 6 ? 'text-gray-600' : 'text-gray-500'}>
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project rows */}
          {byProject.map((proj) => (
            <div key={proj.name} className="border-b border-surface-700">
              {/* Project header */}
              <div className="flex bg-surface-900/30">
                <div className="w-48 shrink-0 px-4 py-2 border-r border-surface-700">
                  <div className="text-xs font-semibold text-gray-200 truncate">{proj.name}</div>
                  <div className="text-[10px] text-gray-500 truncate">{proj.client}</div>
                </div>
                <div className="flex-1 relative h-8" />
              </div>

              {/* Task bars */}
              {proj.tasks.map((task) => {
                const start = task.start_date
                  ? Math.max(0, differenceInDays(parseISO(task.start_date), monthStart))
                  : null;
                const end = task.due_date
                  ? Math.min(totalDays - 1, differenceInDays(parseISO(task.due_date), monthStart))
                  : null;

                if (start === null && end === null) return null;

                const barStart = start ?? end ?? 0;
                const barEnd = end ?? start ?? 0;
                const left = (barStart / totalDays) * 100;
                const width = Math.max(((barEnd - barStart + 1) / totalDays) * 100, 1);

                return (
                  <div key={task.id} className="flex">
                    <div className="w-48 shrink-0 px-4 py-1 border-r border-surface-700 flex items-center">
                      <span className="text-[10px] text-gray-400 truncate pl-3">{task.title}</span>
                    </div>
                    <div className="flex-1 relative h-7 flex items-center">
                      <Link to={`/tasks/${task.id}`}>
                        <motion.div
                          className={`absolute h-5 rounded flex items-center px-2 text-[9px] text-white truncate ${
                            PRIORITY_TRACK[task.priority] ?? 'bg-slate-600'
                          } hover:opacity-80 transition-opacity cursor-pointer`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          initial={{ scaleX: 0, originX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          title={`${task.title} (${task.start_date ?? ''} - ${task.due_date ?? ''})`}
                        >
                          {task.assigned_tool && <span>{task.assigned_tool.slice(0, 8)}</span>}
                        </motion.div>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Today marker */}
          <div className="relative h-0">
            <div
              className="absolute top-0 w-px bg-brand-400/60 pointer-events-none"
              style={{
                left: `calc(${((differenceInDays(today, monthStart)) / totalDays) * 100}% + 192px)`,
                top: `-${byProject.reduce((s, p) => s + p.tasks.length + 1, 0) * 28 + 32}px`,
                height: `${byProject.reduce((s, p) => s + p.tasks.length + 1, 0) * 28 + 32}px`,
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
