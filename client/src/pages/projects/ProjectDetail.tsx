import { useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { KanbanBoard } from '../../components/kanban/KanbanBoard';
import { GanttChart } from '../../components/gantt/GanttChart';
import { projectsApi, tasksApi, toolsApi } from '../../lib/api';
import { useToastStore } from '../../stores/toastStore';
import { AdvisorPanel } from '../../components/ai/AdvisorPanel';
import { ArtifactsTab } from './ArtifactsTab';
import type { KanbanData, Task } from '../../types';

type Tab = 'kanban' | 'gantt' | 'tasks' | 'artifacts' | 'overview';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('kanban');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<string>('todo');
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const res = await projectsApi.get(id!);
      if (!res.data.success) throw new Error('Not found');
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: kanban } = useQuery({
    queryKey: ['kanban', id],
    queryFn: async () => {
      const res = await projectsApi.getKanban(id!);
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled: !!id && (tab === 'kanban' || tab === 'tasks'),
  });

  const { data: ganttTasks = [] } = useQuery({
    queryKey: ['gantt', id],
    queryFn: async () => {
      const res = await projectsApi.getGantt(id!);
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled: !!id && tab === 'gantt',
  });

  const kanbanMoveMutation = useMutation({
    mutationFn: (input: { taskId: string; status: string }) =>
      projectsApi.updateKanban(id!, [{ taskId: input.taskId, status: input.status }]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', id] });
    },
    onError: () => addToast({ type: 'error', message: 'ステータス変更に失敗しました' }),
  });

  const ganttUpdateMutation = useMutation({
    mutationFn: (input: { taskId: string; updates: { start_date?: string; due_date?: string } }) =>
      projectsApi.updateGanttTask(id!, input.taskId, input.updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gantt', id] }),
  });

  const addDepMutation = useMutation({
    mutationFn: (input: { task_id: string; depends_on_task_id: string }) =>
      projectsApi.addDependency(id!, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gantt', id] }),
  });

  if (isLoading || !project) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/projects" className="text-xs text-gray-400 hover:text-gray-200">← プロジェクト一覧</Link>
          <h1 className="text-2xl font-bold text-gray-100 mt-1">{project.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <Badge status={project.status} type="project" />
            <Link to={`/clients/${project.client_id}`} className="text-gray-400 hover:text-brand-300">
              クライアントを開く
            </Link>
          </div>
        </div>
        <Button onClick={() => { setDefaultStatus('todo'); setTaskFormOpen(true); }}>＋ タスク追加</Button>
      </div>

      <AdvisorPanel
        endpoint={`/ai/project-advice/${id}`}
        title="プロジェクト診断 & ツール活用アドバイス"
        queryKey={['ai', 'project-advice', id]}
        autoFetch={false}
      />

      <div className="flex gap-1 border-b border-surface-700">
        {([
          { key: 'kanban', label: 'カンバン' },
          { key: 'gantt', label: 'ガント' },
          { key: 'tasks', label: 'タスク一覧' },
          { key: 'artifacts', label: '成果物' },
          { key: 'overview', label: '概要' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kanban' && kanban && (
        <KanbanBoard
          data={kanban}
          onTaskMove={(taskId, newStatus) => kanbanMoveMutation.mutate({ taskId, status: newStatus })}
          onAddTask={(s) => { setDefaultStatus(s); setTaskFormOpen(true); }}
        />
      )}

      {tab === 'gantt' && (
        <GanttChart
          tasks={ganttTasks}
          onTaskUpdate={(taskId, updates) => ganttUpdateMutation.mutate({ taskId, updates })}
          onAddDependency={(taskId, dependsOnId) =>
            addDepMutation.mutate({ task_id: taskId, depends_on_task_id: dependsOnId })
          }
        />
      )}

      {tab === 'tasks' && kanban && <TaskTable data={kanban} />}

      {tab === 'artifacts' && <ArtifactsTab projectId={id!} />}

      {tab === 'overview' && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-200 mb-3">プロジェクト情報</h3>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-gray-400">説明</dt><dd className="text-gray-100 whitespace-pre-wrap">{project.description || '—'}</dd></div>
            <div><dt className="text-xs text-gray-400">期間</dt><dd className="text-gray-100">{project.start_date ?? '—'} ～ {project.end_date ?? '—'}</dd></div>
            <div><dt className="text-xs text-gray-400">テンプレート</dt><dd className="text-gray-100">{project.template_id ?? '—'}</dd></div>
          </dl>
        </Card>
      )}

      <TaskForm
        isOpen={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        projectId={id!}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}

function TaskTable({ data }: { data: KanbanData }) {
  const all: Task[] = [...data.todo, ...data.in_progress, ...data.review, ...data.done];
  return (
    <Card padding="none">
      <table className="w-full text-sm">
        <thead className="bg-surface-900/60 text-xs text-gray-400">
          <tr>
            <th className="text-left px-4 py-3">タイトル</th>
            <th className="text-left px-4 py-3">ステータス</th>
            <th className="text-left px-4 py-3">優先度</th>
            <th className="text-left px-4 py-3">担当ツール</th>
            <th className="text-left px-4 py-3">開始日</th>
            <th className="text-left px-4 py-3">期日</th>
          </tr>
        </thead>
        <tbody>
          {all.map((t) => (
            <tr key={t.id} className="border-t border-surface-700 hover:bg-surface-700/40">
              <td className="px-4 py-3"><Link to={`/tasks/${t.id}`} className="text-gray-100 hover:text-brand-300">{t.title}</Link></td>
              <td className="px-4 py-3"><Badge status={t.status} type="task" /></td>
              <td className="px-4 py-3"><Badge status={t.priority} type="priority" /></td>
              <td className="px-4 py-3 text-gray-300">{t.assigned_tool ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{t.start_date ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-400">{t.due_date ?? '—'}</td>
            </tr>
          ))}
          {all.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">タスクがありません</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function TaskForm({
  isOpen,
  onClose,
  projectId,
  defaultStatus,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  defaultStatus: string;
}) {
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [assignedTool, setAssignedTool] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data: tools = [] } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await toolsApi.list();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      tasksApi.create({
        project_id: projectId,
        title,
        description,
        status: defaultStatus as Task['status'],
        priority,
        assigned_tool: assignedTool || undefined,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban', projectId] });
      qc.invalidateQueries({ queryKey: ['gantt', projectId] });
      addToast({ type: 'success', message: 'タスクを作成しました' });
      onClose();
      setTitle(''); setDescription(''); setAssignedTool(''); setStartDate(''); setDueDate('');
    },
    onError: () => addToast({ type: 'error', message: '作成に失敗しました' }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title) return;
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新規タスク" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="タイトル *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Textarea label="説明" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        <Select
          label="優先度"
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          options={[
            { value: 'low', label: '低' },
            { value: 'medium', label: '中' },
            { value: 'high', label: '高' },
            { value: 'critical', label: '緊急' },
          ]}
        />
        <Select
          label="担当ツール"
          value={assignedTool}
          onChange={(e) => setAssignedTool(e.target.value)}
          options={[
            { value: '', label: '指定しない' },
            ...tools.map((t) => ({ value: t.identifier, label: t.name })),
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="開始日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="期日" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button type="submit" loading={mutation.isPending}>作成</Button>
        </div>
      </form>
    </Modal>
  );
}
