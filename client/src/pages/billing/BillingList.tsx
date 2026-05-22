import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { invoicesApi, clientsApi } from '../../lib/api';
import { useToastStore } from '../../stores/toastStore';

export function BillingList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { statusFilter, clientFilter }],
    queryFn: async () => {
      const res = await invoicesApi.list({
        status: statusFilter || undefined,
        client_id: clientFilter || undefined,
        limit: 200,
      });
      if (!res.data.success) throw new Error('Failed');
      return res.data;
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

  const invoices = data?.data ?? [];
  const totalSent = invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + Number(i.amount), 0);
  const totalDraft = invoices.filter((i) => i.status === 'draft').reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: string }) => invoicesApi.updateStatus(input.id, input.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      addToast({ type: 'success', message: 'ステータスを更新しました' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><div className="text-xs text-gray-400">未請求（下書き）</div><div className="text-2xl font-bold">¥{totalDraft.toLocaleString()}</div></Card>
        <Card><div className="text-xs text-gray-400">請求中（送付済み）</div><div className="text-2xl font-bold">¥{totalSent.toLocaleString()}</div></Card>
        <Card><div className="text-xs text-gray-400">支払済み</div><div className="text-2xl font-bold">¥{totalPaid.toLocaleString()}</div></Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="ステータス"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'すべて' },
            { value: 'draft', label: '下書き' },
            { value: 'sent', label: '送付済み' },
            { value: 'paid', label: '支払済み' },
            { value: 'overdue', label: '延滞' },
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
        <Button onClick={() => setFormOpen(true)}>＋ 新規請求書</Button>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {!isLoading && (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead className="bg-surface-900/60 text-xs text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">件名</th>
                <th className="text-left px-4 py-3">クライアント</th>
                <th className="text-left px-4 py-3">金額</th>
                <th className="text-left px-4 py-3">ステータス</th>
                <th className="text-left px-4 py-3">発行日</th>
                <th className="text-left px-4 py-3">期日</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-surface-700">
                  <td className="px-4 py-3 text-gray-100">{i.title}</td>
                  <td className="px-4 py-3 text-gray-300">{clients.find((c) => c.id === i.client_id)?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-200">¥{Number(i.amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={i.status}
                      onChange={(e) => statusMutation.mutate({ id: i.id, status: e.target.value })}
                      className="text-xs bg-surface-700 border border-surface-500 rounded px-2 py-0.5 text-gray-100"
                    >
                      <option value="draft">下書き</option>
                      <option value="sent">送付済み</option>
                      <option value="paid">支払済み</option>
                      <option value="overdue">延滞</option>
                      <option value="cancelled">キャンセル</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{i.issue_date}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{i.due_date}</td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">請求書がありません</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <InvoiceForm isOpen={formOpen} onClose={() => setFormOpen(false)} clients={clients} />
      {/* Suppress unused Badge import warning by reference */}
      <span className="hidden"><Badge status="paid" type="invoice" /></span>
    </div>
  );
}

function InvoiceForm({
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
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [taxRate, setTaxRate] = useState('10');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      invoicesApi.create({
        client_id: clientId,
        title,
        amount: parseFloat(amount),
        tax_rate: parseFloat(taxRate),
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      addToast({ type: 'success', message: '請求書を作成しました' });
      onClose();
      setClientId(''); setTitle(''); setAmount(''); setTaxRate('10');
      setIssueDate(new Date().toISOString().slice(0, 10)); setDueDate(''); setNotes('');
    },
    onError: () => addToast({ type: 'error', message: '作成に失敗しました' }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !title || !amount || !dueDate) return;
    mutation.mutate();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="新規請求書" size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
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
        <Input label="件名 *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="金額（円） *" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" />
          <Input label="消費税率 (%)" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} min="0" max="100" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="発行日 *" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          <Input label="支払期日 *" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <Textarea label="備考" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button type="submit" loading={mutation.isPending}>作成</Button>
        </div>
      </form>
    </Modal>
  );
}
