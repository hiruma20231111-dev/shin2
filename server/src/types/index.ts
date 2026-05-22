// ============================================================
// Hub Workspace — Shared TypeScript Types
// ============================================================

// ── Tool Context Packet ──────────────────────────────────────
export interface ToolContextPacket {
  schema_version: string;
  task_id: string;
  client: {
    id: string;
    name: string;
    industry: string;
    dna_summary: string;
  };
  project: {
    id: string;
    name: string;
    description: string;
  };
  tool_target: string;
  payload: unknown;
  result?: unknown;
  sent_at: string; // ISO 8601
}

// ── User ─────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Client ───────────────────────────────────────────────────
export interface Client {
  id: string;
  name: string;
  industry: string;
  status: 'active' | 'inactive' | 'paused';
  tags: string[];
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Client DNA ───────────────────────────────────────────────
export interface ClientDNA {
  id: string;
  client_id: string;
  category: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ── Project ──────────────────────────────────────────────────
export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'review' | 'completed' | 'cancelled';
  template_id?: string | null;
  start_date?: string | null; // date string YYYY-MM-DD
  end_date?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Task ─────────────────────────────────────────────────────
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_tool?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// ── Task Dependency ──────────────────────────────────────────
export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

// ── Tool ─────────────────────────────────────────────────────
export interface Tool {
  id: string;
  identifier: string;
  name: string;
  description: string;
  endpoint_url: string;
  health_endpoint: string;
  capabilities: unknown;
  status: 'online' | 'offline' | 'degraded';
  last_health_check?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Tool Context Packet Record ───────────────────────────────
export interface ToolContextPacketRecord {
  id: string;
  task_id: string;
  tool_identifier: string;
  schema_version: string;
  direction: 'sent' | 'received';
  payload: unknown;
  result?: unknown;
  status: 'pending' | 'sent' | 'received' | 'error';
  error_code?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
  received_at?: string | null;
  created_at: string;
}

// ── Activity Log ─────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  user_id: string;
  client_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  changes?: unknown;
  created_at: string;
}

// ── Project Template ─────────────────────────────────────────
export interface ProjectTemplate {
  id: string;
  name: string;
  industry: string;
  description?: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// ── Template Task ────────────────────────────────────────────
export interface TemplateTask {
  id: string;
  template_id: string;
  title: string;
  tool_identifier?: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  duration_days: number;
  order_index: number;
}

// ── Invoice ──────────────────────────────────────────────────
export interface Invoice {
  id: string;
  client_id: string;
  project_id?: string | null;
  title: string;
  amount: number;
  tax_rate: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  paid_date?: string | null;
  notes?: string | null;
  external_invoice_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Workflow ─────────────────────────────────────────────────
export interface Workflow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// ── Workflow Step ────────────────────────────────────────────
export interface WorkflowStep {
  id: string;
  workflow_id: string;
  task_id: string;
  step_order: number;
  tool_identifier?: string | null;
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'error';
  created_at: string;
}

// ── API Response Helpers ─────────────────────────────────────
export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  total: number;
  page: number;
  limit: number;
};

// ── JWT Payload ──────────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}
