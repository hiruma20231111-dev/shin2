import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { projectsApi, clientsApi, templatesApi } from '../../lib/api';
import { useToastStore } from '../../stores/toastStore';
import type { Project } from '../../types';

export function ProjectList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', { statusFilter, clientFilter }],
    queryFn: async () => {
      const res = await projectsApi.list({
        status: statusFilter || undefined,
        client_id: clientFilter || undefined,
        limit: 200,
      });
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-filter'],
    queryFn: async () => {
      const res = await clientsApi.list({ limit: 200 });
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="ステータス"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'すべて' },
            { value: 'planning', label: '計画中' },
            { value: 'active', label: '進行中' },
            { value: 'review', label: 'レビュー' },
            { value: 'completed', label: '完了' },
            { value: 'cancelled', label: 'キャンセル' },
          ]}
          className="w-40"
        />
        <Select
          label="クライアント"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          options={[
            { value: '', label: 'すべて' },
            ...clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
          className="w-56"
        />
        <div className="flex-1" />
        <Button onClick={() => setFormOpen(true)}>＋ 新規プロジェクト</Button>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} clientName={clients.find((c) => c.id === p.client_id)?.name} />
          ))}
          {projects.length === 0 && (
            <Card className="col-span-full"><p className="text-sm text-gray-500">プロジェクトがありません</p></Card>
          )}
        </div>
      )}

      <ProjectForm isOpen={formOpen} onClose={() => setFormOpen(false)} clients={clients} />
    </div>
  );
}

function ProjectCard({ project, clientName }: { project: Project; clientName?: string }) {
  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="hover:border-brand-500 transition-colors h-full">
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-gray-100">{project.name}</h3>
          <Badge status={project.status} type="project" />
        </div>
        <p className="mt-1 text-sm text-gray-400">{clientName ?? '—'}</p>
        {project.description && (
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">{project.description}</p>
        )}
        <div className="mt-3 text-xs text-gray-500">
          {project.start_date ?? '—'} ～ {project.end_date ?? '—'}
        </div>
      </Card>
    </Link>
  );
}

function ProjectForm({
  isOpen,
  onClose,
  clients,
}: {
  isOpen: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [templateId, setTemplateId] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await templatesApi.list();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      projectsApi.create({
        client_id: clientId,
        name,
        description,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        template_id: templateId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      addToast({ type: 'success', message: 'プロジェクトを作成しました' });
      onClose();
      setName(''); setDescription(''); setStartDate(''); setEndDate(''); setTemplateId(''); setClientId('');
    },
    onError: () => addToast({ type: 'error', message: '作成に失敗しました' }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !name) return;
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新規プロジェクト" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="クライアント *"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
          options={[
            { value: '', label: '選択してください' },
            ...clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Input label="プロジェクト名 *" value={name} onChange={(e) => setName(e.target.value)} required />
        <Textarea label="説明" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="開始日" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="終了日" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Select
          label="テンプレートから作成（任意）"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          options={[
            { value: '', label: '使用しない' },
            ...templates.map((t) => ({ value: t.id, label: `${t.name}（${t.industry}）` })),
          ]}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button type="submit" loading={mutation.isPending}>作成</Button>
        </div>
      </form>
    </Modal>
  );
}
