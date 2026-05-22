export const API_BASE = '/api';

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: '未着手',
  in_progress: '進行中',
  review: 'レビュー',
  done: '完了',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: '計画中',
  active: '進行中',
  review: 'レビュー',
  completed: '完了',
  cancelled: 'キャンセル',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '緊急',
};

export const TOOL_STATUS_LABELS: Record<string, string> = {
  online: 'オンライン',
  offline: 'オフライン',
  degraded: '低下',
};

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  active: '稼働中',
  inactive: '停止',
  paused: '一時停止',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  sent: '送付済み',
  paid: '支払済み',
  overdue: '延滞',
  cancelled: 'キャンセル',
};

export const HEALTH_POLL_INTERVAL_MS = 60_000;
