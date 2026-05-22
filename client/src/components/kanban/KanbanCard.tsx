import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { format, isBefore, parseISO } from 'date-fns';
import { Badge } from '../ui/Badge';
import type { Task } from '../../types';

interface KanbanCardProps {
  task: Task;
}

export function KanbanCard({ task }: KanbanCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const overdue =
    task.due_date && isBefore(parseISO(task.due_date), new Date()) && task.status !== 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={() => navigate(`/tasks/${task.id}`)}
      className="bg-surface-700 hover:bg-surface-600 border border-surface-500 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-colors duration-150"
    >
      <p className="text-sm text-gray-100 font-medium line-clamp-2">{task.title}</p>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <Badge status={task.priority} type="priority" />
        {task.assigned_tool && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-brand-600/20 text-brand-300 border border-brand-600/30">
            {task.assigned_tool}
          </span>
        )}
        {task.due_date && (
          <span className={`text-xs ${overdue ? 'text-red-400' : 'text-gray-400'}`}>
            {format(parseISO(task.due_date), 'MM/dd')}
          </span>
        )}
      </div>
    </div>
  );
}
