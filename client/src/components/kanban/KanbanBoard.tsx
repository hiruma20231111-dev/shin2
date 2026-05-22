import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import type { KanbanData, Task } from '../../types';

interface KanbanBoardProps {
  data: KanbanData;
  onTaskMove: (taskId: string, newStatus: keyof KanbanData) => void;
  onAddTask?: (status: string) => void;
}

const COLUMNS: { id: keyof KanbanData; title: string }[] = [
  { id: 'todo', title: '未着手' },
  { id: 'in_progress', title: '進行中' },
  { id: 'review', title: 'レビュー' },
  { id: 'done', title: '完了' },
];

export function KanbanBoard({ data, onTaskMove, onAddTask }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragStart(e: DragStartEvent) {
    const task = e.active.data.current?.['task'] as Task | undefined;
    if (task) setActiveTask(task);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);

    // Determine target column
    const overData = over.data.current as { task?: Task } | undefined;
    let targetCol: keyof KanbanData;
    if (overData?.task) {
      targetCol = overData.task.status as keyof KanbanData;
    } else {
      targetCol = String(over.id) as keyof KanbanData;
    }

    // Locate the task's current column
    const current = (Object.keys(data) as (keyof KanbanData)[]).find((col) =>
      data[col].some((t) => t.id === taskId),
    );
    if (!current || current === targetCol) return;
    if (!COLUMNS.find((c) => c.id === targetCol)) return;

    onTaskMove(taskId, targetCol);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            tasks={data[col.id]}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <KanbanCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
