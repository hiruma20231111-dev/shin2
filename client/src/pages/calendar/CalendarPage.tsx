import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday, parseISO,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { tasksApi, type CalendarTask } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600/80 text-red-50 border-red-500',
  high: 'bg-orange-600/80 text-orange-50 border-orange-500',
  medium: 'bg-blue-600/80 text-blue-50 border-blue-500',
  low: 'bg-slate-600/80 text-slate-200 border-slate-500',
};

const STATUS_DOT: Record<string, string> = {
  todo: 'bg-gray-400',
  in_progress: 'bg-blue-400',
  review: 'bg-yellow-400',
  done: 'bg-emerald-400',
};

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0);

  const from = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const to = format(endOfMonth(currentDate), 'yyyy-MM-dd');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: async () => {
      const res = await tasksApi.calendar(from, to);
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const tasksByDate = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {};
    for (const task of tasks) {
      const key = task.due_date ?? task.start_date;
      if (!key) continue;
      const d = key.slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(task);
    }
    return map;
  }, [tasks]);

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  function prevMonth() {
    setDirection(-1);
    setCurrentDate((d) => subMonths(d, 1));
  }
  function nextMonth() {
    setDirection(1);
    setCurrentDate((d) => addMonths(d, 1));
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">カレンダー</h1>
          <p className="text-sm text-gray-400 mt-0.5">タスクと締切の一覧</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-surface-700 transition-colors"
          >
            ‹
          </button>
          <span className="text-base font-semibold text-gray-100 w-32 text-center">
            {format(currentDate, 'yyyy年 M月', { locale: ja })}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-surface-700 transition-colors"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => { setDirection(0); setCurrentDate(new Date()); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-brand-600/20 text-brand-300 border border-brand-600/30 hover:bg-brand-600/30 transition-colors"
          >
            今月
          </button>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {!isLoading && (
        <div className="bg-surface-800 border border-surface-600 rounded-xl overflow-hidden shadow-lg">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-surface-600">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`py-2.5 text-center text-xs font-semibold ${
                  i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={format(currentDate, 'yyyy-MM')}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="grid grid-cols-7"
            >
              {calDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate[key] ?? [];
                const inMonth = isSameMonth(day, currentDate);
                const todayFlag = isToday(day);
                const dow = day.getDay();

                return (
                  <div
                    key={key}
                    className={`min-h-[100px] border-b border-r border-surface-700 p-1.5 transition-colors ${
                      inMonth ? 'bg-surface-800' : 'bg-surface-900/50'
                    } ${todayFlag ? 'bg-brand-900/20' : ''}`}
                  >
                    <div
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mb-1 ${
                        todayFlag
                          ? 'bg-brand-500 text-white font-bold'
                          : dow === 0
                          ? 'text-red-400'
                          : dow === 6
                          ? 'text-blue-400'
                          : inMonth
                          ? 'text-gray-300'
                          : 'text-gray-600'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <Link key={task.id} to={`/tasks/${task.id}`}>
                          <div
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-tight border ${
                              PRIORITY_COLORS[task.priority] ?? 'bg-gray-600 text-gray-100 border-gray-500'
                            } hover:opacity-80 transition-opacity truncate`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[task.status] ?? 'bg-gray-400'}`}
                            />
                            <span className="truncate">{task.title}</span>
                          </div>
                        </Link>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[9px] text-gray-500 pl-1">
                          +{dayTasks.length - 3} 件
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span className="font-medium">優先度:</span>
        {['critical', 'high', 'medium', 'low'].map((p) => (
          <span key={p} className={`px-2 py-0.5 rounded border ${PRIORITY_COLORS[p]}`}>
            {{ critical: '緊急', high: '高', medium: '中', low: '低' }[p]}
          </span>
        ))}
        <span className="font-medium ml-2">ステータス:</span>
        {Object.entries(STATUS_DOT).map(([s, cls]) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cls}`} />
            {{ todo: '未着手', in_progress: '進行中', review: 'レビュー', done: '完了' }[s as keyof typeof STATUS_DOT]}
          </span>
        ))}
      </div>

      {/* Monthly task summary */}
      {tasks.length > 0 && (
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">
            {format(currentDate, 'M月', { locale: ja })}のタスク ({tasks.length}件)
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 py-1.5 border-b border-surface-700 text-sm">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[task.status] ?? 'bg-gray-400'}`} />
                <Link to={`/tasks/${task.id}`} className="flex-1 text-gray-200 hover:text-brand-300 truncate">
                  {task.title}
                </Link>
                <span className="text-xs text-gray-500 shrink-0">{task.project_name}</span>
                <span className="text-xs text-gray-500 shrink-0">
                  {task.due_date ? format(parseISO(task.due_date), 'M/d') : task.start_date ? format(parseISO(task.start_date), 'M/d~') : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
