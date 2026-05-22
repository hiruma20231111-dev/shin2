// ============================================================
// Core domain types
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  status: 'active' | 'inactive' | 'paused';
  tags: string[];
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientDNA {
  id: string;
  client_id: string;
  category: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'review' | 'completed' | 'cancelled';
  template_id?: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_tool?: string;
  start_date?: string;
  due_date?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface TaskWithDeps extends Task {
  dependencies: string[];
}

export interface Tool {
  id: string;
  identifier: string;
  name: string;
  description: string;
  endpoint_url: string;
  health_endpoint: string;
  capabilities: Record<string, unknown>;
  status: 'online' | 'offline' | 'degraded';
  last_health_check?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ToolContextPacket {
  schema_version: string;
  task_id: string;
  project_id: string;
  client_id: string;
  tool_identifier: string;
  client_dna: ClientDNA[];
  task: Task;
  project: Project;
  client: Client;
  context: Record<string, unknown>;
}

export interface ToolContextPacketRecord {
  id: string;
  task_id: string;
  tool_identifier: string;
  schema_version: string;
  direction: 'outbound' | 'inbound';
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: 'pending' | 'sent' | 'received' | 'error';
  error_code?: string;
  error_message?: string;
  sent_at?: string;
  received_at?: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  client_id?: string;
  project_id?: string;
  task_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes?: Record<string, unknown>;
  created_at: string;
}

export interface TemplateTask {
  id: string;
  template_id: string;
  title: string;
  tool_identifier?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  duration_days: number;
  order_index: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  industry: string;
  description?: string;
  is_system: boolean;
  tasks?: TemplateTask[];
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  project_id?: string;
  title: string;
  amount: number;
  tax_rate: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  paid_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Aggregate / view types
// ============================================================

export interface KanbanData {
  todo: Task[];
  in_progress: Task[];
  review: Task[];
  done: Task[];
}

export interface ToolStatus {
  identifier: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  last_health_check: string | null;
}

export interface DashboardData {
  thisWeekTasks: Task[];
  activeProjectsCount: number;
  projectCompletionRate: number;
  monthlyRevenue: {
    total: number;
    invoiced: number;
    uninvoiced: number;
  };
  toolStatuses: ToolStatus[];
  recentActivity: ActivityLog[];
}

// ============================================================
// API response wrappers
// ============================================================

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};
