import { useState, FormEvent, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { clientsApi } from '../../lib/api';
import { useToastStore } from '../../stores/toastStore';
import type { Client } from '../../types';

interface ClientFormProps {
  isOpen: boolean;
  onClose: () => void;
  editing?: Client | null;
}

export function ClientForm({ isOpen, onClose, editing }: ClientFormProps) {
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'paused'>('active');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsText, setTagsText] = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setIndustry(editing.industry);
      setStatus(editing.status);
      setEmail(editing.contact_email ?? '');
      setPhone(editing.contact_phone ?? '');
      setNotes(editing.notes ?? '');
      setTagsText((editing.tags ?? []).join(', '));
    } else {
      setName(''); setIndustry(''); setStatus('active');
      setEmail(''); setPhone(''); setNotes(''); setTagsText('');
    }
  }, [editing, isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<Client> = {
        name,
        industry,
        status,
        contact_email: email || undefined,
        contact_phone: phone || undefined,
        notes: notes || undefined,
        tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (editing) {
        return clientsApi.update(editing.id, payload);
      }
      return clientsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      addToast({ type: 'success', message: editing ? 'クライアントを更新しました' : 'クライアントを作成しました' });
      onClose();
    },
    onError: () => {
      addToast({ type: 'error', message: '保存に失敗しました' });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'クライアント編集' : '新規クライアント'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="名前 *" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="業種 *" value={industry} onChange={(e) => setIndustry(e.target.value)} required />
        <Select
          label="ステータス"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          options={[
            { value: 'active', label: '稼働中' },
            { value: 'paused', label: '一時停止' },
            { value: 'inactive', label: '停止' },
          ]}
        />
        <Input label="メールアドレス" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="電話番号" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input
          label="タグ（カンマ区切り）"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="例: VIP, LP制作, 月額契約"
        />
        <Textarea label="メモ" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {editing ? '更新' : '作成'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
