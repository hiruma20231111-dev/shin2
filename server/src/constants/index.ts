export const TOOL_CONTEXT_PACKET_SCHEMA_VERSION = '1.0.0';

export const HEALTH_POLL_INTERVAL_MS = 60_000;

export const JWT_ACCESS_EXPIRES_IN_SEC = 900;    // 15 minutes
export const JWT_REFRESH_EXPIRES_IN_SEC = 604_800; // 7 days

export const BCRYPT_ROUNDS = 12;

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  DONE: 'done',
} as const;

export const PROJECT_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  REVIEW: 'review',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const TOOL_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  DEGRADED: 'degraded',
} as const;

export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export const PACKET_ERROR_CODES = {
  TOOL_UNREACHABLE: 'TOOL_UNREACHABLE',
  SCHEMA_VERSION_MISMATCH: 'SCHEMA_VERSION_MISMATCH',
  DNA_SUMMARY_FAILED: 'DNA_SUMMARY_FAILED',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_OFFLINE: 'TOOL_OFFLINE',
} as const;

export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
} as const;
