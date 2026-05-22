import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { tasksApi, toolsApi } from '../../lib/api';
import { useToastStore } from '../../stores/toastStore';
import type { Task } from '../../types';

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [expandedPacket, setExpandedPacket] = useState<string | null>(null);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      const res = await tasksApi.get(id!);
      if (!res.data.success) throw new Error('Not found');
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: packets = [] } = useQuery({
    queryKey: ['task-packets', id],
    queryFn: async () => {
      const res = await tasksApi.getPackets(id!);
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: tools = [] } = useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const res = await toolsApi.list();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Task>) => tasksApi.update(id!, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      addToast({ type: 'success', message: '保存しました' });
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => tasksApi.execute(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-packets', id] });
      addToast({ type: 'success', message: 'ツールへ送信しました' });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'ツール送信に失敗しました';
      addToast({ type: 'error', message: msg });
    },
  });

  if (isLoading || !task) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <Link to={`/projects/${task.project_id}`} className="text-xs text-gray-400 hover:text-gray-200">
        ← プロジェクトに戻る
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Task info */}
        <Card className="lg:col-span-2">
          <Input
            label="タイトル"
            value={task.title}
            onChange={(e) => updateMutation.mutate({ title: e.target.value })}
          />
          <div className="mt-3">
            <Textarea
              label="説明"
              value={task.description}
              onChange={(e) => updateMutation.mutate({ description: e.target.value })}
              rows={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Select
              label="ステータス"
              value={task.status}
              onChange={(e) => updateMutation.mutate({ status: e.target.value as Task['status'] })}
              options={[
                { value: 'todo', label: '未着手' },
                { value: 'in_progress', label: '進行中' },
                { value: 'review', label: 'レビュー' },
                { value: 'done', label: '完了' },
              ]}
            />
            <Select
              label="優先度"
              value={task.priority}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value as Task['priority'] })}
              options={[
                { value: 'low', label: '低' },
                { value: 'medium', label: '中' },
                { value: 'high', label: '高' },
                { value: 'critical', label: '緊急' },
              ]}
            />
            <Select
              label="担当ツール"
              value={task.assigned_tool ?? ''}
              onChange={(e) => updateMutation.mutate({ assigned_tool: e.target.value || undefined })}
              options={[
                { value: '', label: '指定なし' },
                ...tools.map((t) => ({ value: t.identifier, label: t.name })),
              ]}
            />
            <Input
              label="期日"
              type="date"
              value={task.due_date ?? ''}
              onChange={(e) => updateMutation.mutate({ due_date: e.target.value || undefined })}
            />
          </div>
        </Card>

        {/* Right: ToolContextPacket */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200">ツール連携</h3>
            {task.assigned_tool && <Badge status="online" type="tool" />}
          </div>
          {!task.assigned_tool ? (
            <p className="text-xs text-gray-500">担当ツールを設定すると実行できます</p>
          ) : (
            <Button
              onClick={() => executeMutation.mutate()}
              loading={executeMutation.isPending}
              className="w-full"
            >
              ツールを実行
            </Button>
          )}

          <h4 className="text-xs font-semibold text-gray-400 mt-4 mb-2">パケット履歴</h4>
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {packets.map((p) => (
              <li key={p.id} className="border border-surface-700 rounded-lg p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">
                    {p.direction === 'sent' ? '→' : '←'} {p.tool_identifier}
                  </span>
                  <span className={`px-2 py-0.5 rounded ${
                    p.status === 'received' ? 'bg-emerald-700' :
                    p.status === 'error' ? 'bg-red-700' :
                    p.status === 'sent' ? 'bg-blue-700' : 'bg-gray-700'
                  } text-white`}>
                    {p.status}
                  </span>
                </div>
                <div className="text-gray-500 mt-1">
                  {p.sent_at ? format(parseISO(p.sent_at), 'MM/dd HH:mm:ss') : format(parseISO(p.created_at), 'MM/dd HH:mm:ss')}
                </div>
                {p.error_message && <div className="text-red-400 mt-1">{p.error_message}</div>}
                <button
                  type="button"
                  onClick={() => setExpandedPacket(expandedPacket === p.id ? null : p.id)}
                  className="mt-1 text-brand-400 hover:text-brand-300"
                >
                  {expandedPacket === p.id ? '閉じる' : 'ペイロード表示'}
                </button>
                {expandedPacket === p.id && (
                  <pre className="mt-2 p-2 bg-surface-900 rounded text-[10px] overflow-x-auto max-h-64">
                    {JSON.stringify(p.payload, null, 2)}
                    {p.result && '\n--- result ---\n' + JSON.stringify(p.result, null, 2)}
                  </pre>
                )}
              </li>
            ))}
            {packets.length === 0 && (
              <li className="text-xs text-gray-500">パケットはまだありません</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
