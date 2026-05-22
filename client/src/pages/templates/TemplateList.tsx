import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import { templatesApi } from '../../lib/api';
import type { ProjectTemplate } from '../../types';

export function TemplateList() {
  const [industryFilter, setIndustryFilter] = useState('');
  const [detailTemplate, setDetailTemplate] = useState<ProjectTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await templatesApi.list();
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
  });

  const industries = Array.from(new Set(templates.map((t) => t.industry)));
  const filtered = industryFilter
    ? templates.filter((t) => t.industry === industryFilter)
    : templates;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <Select
          label="業種フィルター"
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          options={[
            { value: '', label: 'すべて' },
            ...industries.map((i) => ({ value: i, label: i })),
          ]}
          className="w-56"
        />
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-100">{t.name}</h3>
                  <p className="text-xs text-gray-500">{t.industry}</p>
                </div>
                {t.is_system && (
                  <span className="text-xs px-2 py-0.5 rounded bg-brand-600/20 text-brand-300 border border-brand-600/30">
                    システム
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-400">タスク数: {t.tasks?.length ?? 0}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => setDetailTemplate(t)}
              >
                詳細を表示
              </Button>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="col-span-full"><p className="text-sm text-gray-500">テンプレートがありません</p></Card>
          )}
        </div>
      )}

      <Modal
        isOpen={!!detailTemplate}
        onClose={() => setDetailTemplate(null)}
        title={detailTemplate?.name ?? ''}
        size="md"
      >
        {detailTemplate && (
          <div>
            <p className="text-sm text-gray-400 mb-3">業種: {detailTemplate.industry}</p>
            <h4 className="text-sm font-semibold text-gray-200 mb-2">タスク一覧</h4>
            <ol className="space-y-2">
              {(detailTemplate.tasks ?? []).map((tt) => (
                <li key={tt.id} className="border-b border-surface-700 pb-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-100">{tt.title}</span>
                    <span className="text-xs text-gray-400">{tt.duration_days}日</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {tt.tool_identifier && `ツール: ${tt.tool_identifier} / `}
                    優先度: {tt.priority}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Modal>
    </div>
  );
}
