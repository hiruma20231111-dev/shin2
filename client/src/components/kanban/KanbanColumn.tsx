import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import type { Task } from '../../types';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  onAddTask?: (status: string) => void;
}

export function KanbanColumn({ id, title, tasks, onAddTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col w-72 bg-surface-900/50 rounded-xl border border-surface-700">
      <div className="px-4 py-3 flex items-center justify-between border-b border-surface-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-md bg-surface-700 text-gray-400">
            {tasks.length}
          </span>
        </div>
        {onAddTask && (
          <button
            type="button"
            onClick={() => onAddTask(id)}
            aria-label="タスクを追加"
            className="text-gray-400 hover:text-gray-100 text-lg leading-none"
          >
            ＋
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto transition-colors ${
          isOver ? 'bg-brand-600/10' : ''
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
