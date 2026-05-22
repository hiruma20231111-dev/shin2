// ============================================================
// Hub Workspace — Interactive Gantt Chart
//
// Implements three drag interactions per spec:
//   (a) center drag  → shift start & due dates by the same delta
//   (b) right-edge   → resize due date only (min 1-day duration)
//   (c) dep arrow    → drag dependency endpoint to a different task
// ============================================================
import { useState, useRef, useMemo, useEffect } from 'react';
import { addDays, differenceInDays, format, parseISO, startOfMonth, addMonths } from 'date-fns';
import type { TaskWithDeps } from '../../types';

const DAY_WIDTH_PX = 28;
const ROW_HEIGHT_PX = 40;
const TASK_PANEL_WIDTH = 240;
const HEADER_HEIGHT = 56;
const BAR_HEIGHT = 24;
const EDGE_ZONE_RATIO = 0.2;

type DragMode = 'move' | 'resize-end' | 'dependency';

interface DragState {
  mode: DragMode;
  taskId: string;
  startX: number;
  originalStart: Date;
  originalDue: Date;
  /** For dependency drag: existing dep id we're re-targeting (null = creating new) */
  dependencyId?: string | null;
  /** Source task id when dragging a dependency arrow */
  sourceTaskId?: string;
}

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

interface GanttChartProps {
  tasks: TaskWithDeps[];
  /** Map of dep id → { task_id, depends_on_task_id }. Optional; needed for dependency endpoint drag. */
  dependencyIdMap?: Record<string, { task_id: string; depends_on_task_id: string }>;
  onTaskUpdate: (taskId: string, updates: { start_date?: string; due_date?: string }) => void;
  onAddDependency: (taskId: string, dependsOnId: string) => void;
  onRemoveDependency?: (dependencyId: string) => void;
}

function fmt(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function parse(d: string | null | undefined, fallback: Date): Date {
  if (!d) return fallback;
  try {
    return parseISO(d);
  } catch {
    return fallback;
  }
}

export function GanttChart({
  tasks,
  onTaskUpdate,
  onAddDependency,
  onRemoveDependency,
}: GanttChartProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const dayWidth = DAY_WIDTH_PX * zoom;

  // ── Timeline window ────────────────────────────────────────
  const { timelineStart, totalDays, monthMarkers } = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(addMonths(now, -1));
    const end = addMonths(start, 5); // 6 months window
    const days = differenceInDays(end, start);
    const markers: { date: Date; offsetDays: number }[] = [];
    for (let m = 0; m <= 5; m++) {
      const d = addMonths(start, m);
      markers.push({ date: d, offsetDays: differenceInDays(d, start) });
    }
    return { timelineStart: start, totalDays: days, monthMarkers: markers };
  }, []);

  const totalWidth = totalDays * dayWidth;
  const todayOffset = differenceInDays(new Date(), timelineStart) * dayWidth;

  // ── Drag handling ──────────────────────────────────────────
  useEffect(() => {
    if (!dragState) return;

    function handleMove(e: MouseEvent) {
      const ds = dragState!;
      const deltaPx = e.clientX - ds.startX;
      const deltaDays = Math.round(deltaPx / dayWidth);

      if (ds.mode === 'move') {
        const ns = addDays(ds.originalStart, deltaDays);
        const nd = addDays(ds.originalDue, deltaDays);
        setTooltip({
          x: e.clientX + 12,
          y: e.clientY + 12,
          text: `開始: ${fmt(ns)} / 終了: ${fmt(nd)}`,
        });
      } else if (ds.mode === 'resize-end') {
        const minDue = addDays(ds.originalStart, 1);
        let nd = addDays(ds.originalDue, deltaDays);
        if (nd.getTime() < minDue.getTime()) nd = minDue;
        setTooltip({
          x: e.clientX + 12,
          y: e.clientY + 12,
          text: `終了: ${fmt(nd)}`,
        });
      } else if (ds.mode === 'dependency') {
        setTooltip({
          x: e.clientX + 12,
          y: e.clientY + 12,
          text: '依存先タスクの上で離してください',
        });
      }
    }

    function handleUp(e: MouseEvent) {
      const ds = dragState!;
      const deltaPx = e.clientX - ds.startX;
      const deltaDays = Math.round(deltaPx / dayWidth);

      if (ds.mode === 'move' && deltaDays !== 0) {
        const ns = addDays(ds.originalStart, deltaDays);
        const nd = addDays(ds.originalDue, deltaDays);
        onTaskUpdate(ds.taskId, { start_date: fmt(ns), due_date: fmt(nd) });
      } else if (ds.mode === 'resize-end' && deltaDays !== 0) {
        const minDue = addDays(ds.originalStart, 1);
        let nd = addDays(ds.originalDue, deltaDays);
        if (nd.getTime() < minDue.getTime()) nd = minDue;
        onTaskUpdate(ds.taskId, { due_date: fmt(nd) });
      } else if (ds.mode === 'dependency') {
        // Find target task under cursor by elementFromPoint
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const taskRow = el?.closest('[data-gantt-task-id]') as HTMLElement | null;
        const targetTaskId = taskRow?.dataset['ganttTaskId'];
        if (targetTaskId && targetTaskId !== ds.sourceTaskId) {
          if (ds.dependencyId && onRemoveDependency) {
            onRemoveDependency(ds.dependencyId);
          }
          onAddDependency(ds.sourceTaskId!, targetTaskId);
        }
      }

      setDragState(null);
      setTooltip(null);
    }

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, dayWidth, onTaskUpdate, onAddDependency, onRemoveDependency]);

  // ── Bar render data ────────────────────────────────────────
  const rows = useMemo(() => {
    return tasks.map((task, idx) => {
      const fallback = addDays(new Date(), idx);
      const start = parse(task.start_date, fallback);
      const due = parse(task.due_date, addDays(start, 1));
      const xStart = differenceInDays(start, timelineStart) * dayWidth;
      const xEnd = differenceInDays(due, timelineStart) * dayWidth;
      return {
        task,
        start,
        due,
        xStart,
        width: Math.max(dayWidth, xEnd - xStart),
        y: idx * ROW_HEIGHT_PX,
      };
    });
  }, [tasks, timelineStart, dayWidth]);

  const priorityColor: Record<string, string> = {
    low: 'fill-slate-500',
    medium: 'fill-blue-500',
    high: 'fill-orange-500',
    critical: 'fill-red-500',
  };

  function handleBarMouseDown(
    e: React.MouseEvent,
    task: TaskWithDeps,
    barLeftX: number,
    barWidth: number,
  ) {
    e.preventDefault();
    const localX = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const ratio = localX / barWidth;
    const start = parse(task.start_date, new Date());
    const due = parse(task.due_date, addDays(start, 1));
    const mode: DragMode = ratio > 1 - EDGE_ZONE_RATIO ? 'resize-end' : 'move';
    void barLeftX;
    setDragState({
      mode,
      taskId: task.id,
      startX: e.clientX,
      originalStart: start,
      originalDue: due,
    });
  }

  function handleDependencyDotMouseDown(e: React.MouseEvent, sourceTaskId: string) {
    e.preventDefault();
    e.stopPropagation();
    const start = new Date();
    setDragState({
      mode: 'dependency',
      taskId: sourceTaskId,
      sourceTaskId,
      startX: e.clientX,
      originalStart: start,
      originalDue: start,
      dependencyId: null,
    });
  }

  // ── Dependency arrows ──────────────────────────────────────
  const dependencyArrows = useMemo(() => {
    const arrows: { from: { x: number; y: number }; to: { x: number; y: number }; taskId: string; depId: string }[] = [];
    rows.forEach((row) => {
      for (const depId of row.task.dependencies) {
        const fromRow = rows.find((r) => r.task.id === depId);
        if (!fromRow) continue;
        arrows.push({
          from: { x: fromRow.xStart + fromRow.width, y: fromRow.y + ROW_HEIGHT_PX / 2 },
          to: { x: row.xStart, y: row.y + ROW_HEIGHT_PX / 2 },
          taskId: row.task.id,
          depId,
        });
      }
    });
    return arrows;
  }, [rows]);

  return (
    <div className="flex flex-col bg-surface-900/40 border border-surface-700 rounded-xl overflow-hidden">
      {/* Zoom controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700 text-sm text-gray-300">
        <span>ガントチャート</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="px-2 py-1 hover:bg-surface-700 rounded"
          >
            －
          </button>
          <span className="text-xs">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
            className="px-2 py-1 hover:bg-surface-700 rounded"
          >
            ＋
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex overflow-auto" style={{ maxHeight: '70vh' }}>
        {/* Task name column */}
        <div
          className="sticky left-0 z-10 bg-surface-900 border-r border-surface-700"
          style={{ width: TASK_PANEL_WIDTH, minWidth: TASK_PANEL_WIDTH }}
        >
          <div
            className="border-b border-surface-700 px-3 flex items-center text-xs font-semibold text-gray-400"
            style={{ height: HEADER_HEIGHT }}
          >
            タスク名
          </div>
          {rows.map((r) => (
            <div
              key={r.task.id}
              data-gantt-task-id={r.task.id}
              className="border-b border-surface-700 px-3 flex items-center text-sm text-gray-200 truncate"
              style={{ height: ROW_HEIGHT_PX }}
              title={r.task.title}
            >
              {r.task.title}
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div className="relative" style={{ width: totalWidth, minWidth: totalWidth }}>
          {/* Month header */}
          <div
            className="sticky top-0 z-10 bg-surface-900 border-b border-surface-700"
            style={{ height: HEADER_HEIGHT }}
          >
            {monthMarkers.map((m, idx) => {
              const nextOffset = monthMarkers[idx + 1]?.offsetDays ?? totalDays;
              const width = (nextOffset - m.offsetDays) * dayWidth;
              return (
                <div
                  key={m.offsetDays}
                  className="absolute top-0 h-full border-r border-surface-700 px-2 flex items-center text-xs text-gray-300"
                  style={{ left: m.offsetDays * dayWidth, width }}
                >
                  {format(m.date, 'yyyy/MM')}
                </div>
              );
            })}
          </div>

          {/* Grid + bars */}
          <div className="relative" style={{ height: rows.length * ROW_HEIGHT_PX }}>
            {/* Day grid (lightly) */}
            {monthMarkers.map((m) => (
              <div
                key={`grid-${m.offsetDays}`}
                className="absolute top-0 bottom-0 border-r border-surface-800"
                style={{ left: m.offsetDays * dayWidth }}
              />
            ))}

            {/* Today line */}
            {todayOffset > 0 && todayOffset < totalWidth && (
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500/70"
                style={{ left: todayOffset }}
                aria-label="今日"
              />
            )}

            {/* Bars */}
            {rows.map((r) => {
              const barTop = r.y + (ROW_HEIGHT_PX - BAR_HEIGHT) / 2;
              return (
                <div
                  key={r.task.id}
                  data-gantt-task-id={r.task.id}
                  className="absolute left-0 right-0 border-b border-surface-800"
                  style={{ top: r.y, height: ROW_HEIGHT_PX }}
                >
                  <div
                    onMouseDown={(e) => handleBarMouseDown(e, r.task, r.xStart, r.width)}
                    className={`absolute rounded-md cursor-grab active:cursor-grabbing border border-white/10 hover:brightness-110 transition-all`}
                    style={{
                      left: r.xStart,
                      width: r.width,
                      top: barTop,
                      height: BAR_HEIGHT,
                    }}
                  >
                    <svg
                      width={r.width}
                      height={BAR_HEIGHT}
                      className="rounded-md"
                    >
                      <rect
                        x={0}
                        y={0}
                        width={r.width}
                        height={BAR_HEIGHT}
                        rx={4}
                        className={priorityColor[r.task.priority] ?? 'fill-slate-500'}
                      />
                      {/* Resize handle on right */}
                      <rect
                        x={r.width - 4}
                        y={2}
                        width={4}
                        height={BAR_HEIGHT - 4}
                        rx={2}
                        className="fill-white/40"
                      />
                    </svg>
                    <span className="absolute inset-0 px-2 flex items-center text-xs text-white font-medium pointer-events-none truncate">
                      {r.task.title}
                    </span>
                  </div>

                  {/* Dependency-arrow drag handle on bar's right edge */}
                  <div
                    onMouseDown={(e) => handleDependencyDotMouseDown(e, r.task.id)}
                    title="依存関係を作成"
                    className="absolute w-3 h-3 rounded-full bg-brand-400 border-2 border-surface-900 cursor-crosshair hover:scale-125 transition-transform"
                    style={{
                      left: r.xStart + r.width - 6,
                      top: barTop + BAR_HEIGHT / 2 - 6,
                    }}
                  />
                </div>
              );
            })}

            {/* Dependency arrows (SVG layer) */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={totalWidth}
              height={rows.length * ROW_HEIGHT_PX}
            >
              {dependencyArrows.map((arr) => {
                const cx = (arr.from.x + arr.to.x) / 2;
                const path = `M ${arr.from.x} ${arr.from.y} C ${cx} ${arr.from.y}, ${cx} ${arr.to.y}, ${arr.to.x} ${arr.to.y}`;
                return (
                  <g key={`${arr.taskId}-${arr.depId}`}>
                    <path d={path} stroke="rgba(148,163,184,0.7)" strokeWidth={1.5} fill="none" />
                    <polygon
                      points={`${arr.to.x},${arr.to.y} ${arr.to.x - 6},${arr.to.y - 3} ${arr.to.x - 6},${arr.to.y + 3}`}
                      fill="rgba(148,163,184,0.9)"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-1.5 bg-surface-900 border border-surface-600 rounded-md text-xs text-gray-100 shadow-xl pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
