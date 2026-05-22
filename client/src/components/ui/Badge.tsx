type BadgeType = 'task' | 'project' | 'tool' | 'client' | 'priority' | 'invoice';

interface BadgeProps {
  status: string;
  type: BadgeType;
  className?: string;
}

const taskColors: Record<string, string> = {
  todo: 'bg-gray-700 text-gray-200',
  in_progress: 'bg-blue-700 text-blue-100',
  review: 'bg-yellow-700 text-yellow-100',
  done: 'bg-emerald-700 text-emerald-100',
};

const projectColors: Record<string, string> = {
  planning: 'bg-gray-700 text-gray-200',
  active: 'bg-blue-700 text-blue-100',
  review: 'bg-yellow-700 text-yellow-100',
  completed: 'bg-emerald-700 text-emerald-100',
  cancelled: 'bg-red-800 text-red-100',
};

const toolColors: Record<string, string> = {
  online: 'bg-emerald-600 text-emerald-50',
  offline: 'bg-red-700 text-red-100',
  degraded: 'bg-amber-700 text-amber-100',
};

const clientColors: Record<string, string> = {
  active: 'bg-emerald-700 text-emerald-100',
  inactive: 'bg-gray-700 text-gray-200',
  paused: 'bg-amber-700 text-amber-100',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-700 text-slate-200',
  medium: 'bg-blue-700 text-blue-100',
  high: 'bg-orange-700 text-orange-100',
  critical: 'bg-red-700 text-red-100',
};

const invoiceColors: Record<string, string> = {
  draft: 'bg-gray-700 text-gray-200',
  sent: 'bg-blue-700 text-blue-100',
  paid: 'bg-emerald-700 text-emerald-100',
  overdue: 'bg-red-700 text-red-100',
  cancelled: 'bg-slate-700 text-slate-300',
};

const labelMaps = {
  task: {
    todo: '未着手', in_progress: '進行中', review: 'レビュー', done: '完了',
  } as Record<string, string>,
  project: {
    planning: '計画中', active: '進行中', review: 'レビュー', completed: '完了', cancelled: 'キャンセル',
  } as Record<string, string>,
  tool: {
    online: 'オンライン', offline: 'オフライン', degraded: '低下',
  } as Record<string, string>,
  client: {
    active: '稼働中', inactive: '停止', paused: '一時停止',
  } as Record<string, string>,
  priority: {
    low: '低', medium: '中', high: '高', critical: '緊急',
  } as Record<string, string>,
  invoice: {
    draft: '下書き', sent: '送付済', paid: '支払済', overdue: '延滞', cancelled: 'キャンセル',
  } as Record<string, string>,
};

const colorMaps = {
  task: taskColors,
  project: projectColors,
  tool: toolColors,
  client: clientColors,
  priority: priorityColors,
  invoice: invoiceColors,
};

export function Badge({ status, type, className = '' }: BadgeProps) {
  const color = colorMaps[type][status] ?? 'bg-gray-700 text-gray-200';
  const label = labelMaps[type][status] ?? status;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${color} ${className}`}
    >
      {label}
    </span>
  );
}
