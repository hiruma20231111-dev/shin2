import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import api from '../../lib/api';

interface AdvisorResponse {
  summary?: string;
  advice?: string;
}

type Props = {
  endpoint: string;
  title: string;
  queryKey: readonly unknown[];
  autoFetch?: boolean;
};

export function AdvisorPanel({ endpoint, title, queryKey, autoFetch = true }: Props) {
  const [enabled, setEnabled] = useState(autoFetch);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AdvisorResponse }>(endpoint);
      if (!res.data.success) throw new Error('Failed');
      return res.data.data;
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const text = data?.summary ?? data?.advice ?? '';
  const isAxiosError = error as { response?: { status?: number } } | null;
  const aiDisabled = isAxiosError?.response?.status === 200 && text.includes('ANTHROPIC_API_KEY');

  return (
    <Card className="border-l-2 border-l-violet-500/60 bg-gradient-to-br from-violet-950/30 to-surface-900">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
          <span className="text-[10px] text-violet-400 font-mono">Claude Sonnet 4.6</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEnabled(true);
            refetch();
          }}
          disabled={isFetching}
        >
          {isFetching ? '生成中…' : '更新'}
        </Button>
      </div>

      {!enabled && !data && (
        <div className="py-4 text-center">
          <Button size="sm" variant="primary" onClick={() => setEnabled(true)}>
            AIアドバイスを生成
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
          <Spinner size="sm" />
          <span>分析中…</span>
        </div>
      )}

      {error && !aiDisabled && (
        <p className="text-sm text-red-400">
          アドバイスの取得に失敗しました。
          {process.env['NODE_ENV'] === 'development' && (error as Error).message}
        </p>
      )}

      {text && (
        <div className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">{text}</div>
      )}
    </Card>
  );
}
