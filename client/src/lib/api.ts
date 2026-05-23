import axios from 'axios';
import type {
  ApiResponse,
  AuthResponse,
  Client,
  ClientDNA,
  Project,
  Task,
  Tool,
  ToolContextPacketRecord,
  ActivityLog,
  Invoice,
  ProjectTemplate,
  DashboardData,
  KanbanData,
  TaskWithDeps,
  PaginatedResponse,
} from '../types';

// ============================================================
// Axios instance
// ============================================================

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // needed for HttpOnly refresh-token cookie
  headers: { 'Content-Type': 'application/json' },
});

// Lazy import to avoid circular dependency at module evaluation time
function getAuthStore() {
  // Dynamic import of the store to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__authStore as
    | { getState: () => { accessToken: string | null; clearAuth: () => void; updateToken: (t: string) => void } }
    | undefined;
}

// Request interceptor — attach Bearer token from in-memory store
api.interceptors.request.use((config) => {
  const store = getAuthStore();
  const token = store?.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track whether a refresh is in flight
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processRefreshQueue(error: unknown, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  refreshQueue = [];
}

// Response interceptor — handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue request until refresh resolves
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<ApiResponse<{ accessToken: string }>>(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        );

        if (data.success) {
          const newToken = data.data.accessToken;
          const store = getAuthStore();
          store?.getState().updateToken(newToken);
          processRefreshQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshError) {
        processRefreshQueue(refreshError, null);
        const store = getAuthStore();
        store?.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ============================================================
// Auth API
// ============================================================

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  refresh: () => api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh'),

  me: () => api.get<ApiResponse<import('../types').User>>('/auth/me'),
};

// ============================================================
// Clients API
// ============================================================

export const clientsApi = {
  list: (params?: {
    status?: string;
    industry?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<Client>>('/clients', { params }),

  get: (id: string) => api.get<ApiResponse<Client>>(`/clients/${id}`),

  create: (data: Partial<Client>) => api.post<ApiResponse<Client>>('/clients', data),

  update: (id: string, data: Partial<Client>) =>
    api.put<ApiResponse<Client>>(`/clients/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse<null>>(`/clients/${id}`),

  getDna: (id: string) => api.get<ApiResponse<ClientDNA[]>>(`/clients/${id}/dna`),

  addDna: (id: string, data: { category: string; content: string }) =>
    api.post<ApiResponse<ClientDNA>>(`/clients/${id}/dna`, data),

  updateDna: (id: string, dnaId: string, data: Partial<ClientDNA>) =>
    api.put<ApiResponse<ClientDNA>>(`/clients/${id}/dna/${dnaId}`, data),

  deleteDna: (id: string, dnaId: string) =>
    api.delete<ApiResponse<null>>(`/clients/${id}/dna/${dnaId}`),
};

// ============================================================
// Projects API
// ============================================================

export const projectsApi = {
  list: (params?: {
    client_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<Project>>('/projects', { params }),

  get: (id: string) => api.get<ApiResponse<Project>>(`/projects/${id}`),

  create: (data: Partial<Project>) => api.post<ApiResponse<Project>>('/projects', data),

  update: (id: string, data: Partial<Project>) =>
    api.put<ApiResponse<Project>>(`/projects/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse<null>>(`/projects/${id}`),

  getKanban: (id: string) => api.get<ApiResponse<KanbanData>>(`/projects/${id}/kanban`),

  updateKanban: (id: string, updates: Array<{ taskId: string; status: string }>) =>
    api.put<ApiResponse<null>>(`/projects/${id}/kanban`, { updates }),

  getGantt: (id: string) => api.get<ApiResponse<TaskWithDeps[]>>(`/projects/${id}/gantt`),

  updateGanttTask: (
    projectId: string,
    taskId: string,
    data: { start_date?: string; due_date?: string; order_index?: number },
  ) => api.put<ApiResponse<Task>>(`/projects/${projectId}/gantt/${taskId}`, data),

  addDependency: (
    projectId: string,
    data: { task_id: string; depends_on_task_id: string },
  ) => api.post<ApiResponse<{ id: string }>>(`/projects/${projectId}/dependencies`, data),

  removeDependency: (projectId: string, dependencyId: string) =>
    api.delete<ApiResponse<null>>(`/projects/${projectId}/dependencies/${dependencyId}`),
};

// ============================================================
// Tasks API
// ============================================================

export const tasksApi = {
  get: (id: string) => api.get<ApiResponse<Task>>(`/tasks/${id}`),

  create: (data: Partial<Task>) => api.post<ApiResponse<Task>>('/tasks', data),

  update: (id: string, data: Partial<Task>) =>
    api.put<ApiResponse<Task>>(`/tasks/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse<null>>(`/tasks/${id}`),

  execute: (id: string) =>
    api.post<ApiResponse<ToolContextPacketRecord>>(`/tasks/${id}/execute`),

  getPackets: (id: string) =>
    api.get<ApiResponse<ToolContextPacketRecord[]>>(`/tasks/${id}/packets`),

  receiveResult: (id: string, packetId: string, result: Record<string, unknown>) =>
    api.post<ApiResponse<ToolContextPacketRecord>>(
      `/tasks/${id}/packets/${packetId}/result`,
      { result },
    ),
};

// ============================================================
// Tools API
// ============================================================

export const toolsApi = {
  list: () => api.get<ApiResponse<Tool[]>>('/tools'),

  create: (data: Partial<Tool>) => api.post<ApiResponse<Tool>>('/tools', data),

  update: (id: string, data: Partial<Tool>) =>
    api.put<ApiResponse<Tool>>(`/tools/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse<null>>(`/tools/${id}`),

  healthCheck: (id: string) =>
    api.post<ApiResponse<{ status: string; checked_at: string }>>(`/tools/${id}/health`),
};

// ============================================================
// Dashboard API
// ============================================================

export const dashboardApi = {
  get: () => api.get<ApiResponse<DashboardData>>('/dashboard'),
};

// ============================================================
// Templates API
// ============================================================

export const templatesApi = {
  list: () => api.get<ApiResponse<ProjectTemplate[]>>('/templates'),

  get: (id: string) => api.get<ApiResponse<ProjectTemplate>>(`/templates/${id}`),

  create: (data: Partial<ProjectTemplate>) =>
    api.post<ApiResponse<ProjectTemplate>>('/templates', data),

  update: (id: string, data: Partial<ProjectTemplate>) =>
    api.put<ApiResponse<ProjectTemplate>>(`/templates/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse<null>>(`/templates/${id}`),

  fromProject: (projectId: string, name: string) =>
    api.post<ApiResponse<ProjectTemplate>>('/templates/from-project', {
      project_id: projectId,
      name,
    }),
};

// ============================================================
// Activity logs API
// ============================================================

export const activityApi = {
  list: (params?: { page?: number; limit?: number; entity_type?: string }) =>
    api.get<PaginatedResponse<ActivityLog>>('/activity', { params }),

  getForClient: (clientId: string) =>
    api.get<ApiResponse<ActivityLog[]>>(`/clients/${clientId}/activity`),
};

// ============================================================
// Invoices API
// ============================================================

// ============================================================
// Artifacts API
// ============================================================

export interface Artifact {
  id: string;
  project_id: string;
  task_id: string | null;
  tool_identifier: string | null;
  title: string;
  artifact_type: 'file' | 'url' | 'text' | 'image' | 'json';
  content: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const artifactsApi = {
  list: (projectId: string) =>
    api.get<ApiResponse<Artifact[]>>(`/projects/${projectId}/artifacts`),
  create: (projectId: string, data: Partial<Artifact>) =>
    api.post<ApiResponse<Artifact>>(`/projects/${projectId}/artifacts`, data),
  delete: (projectId: string, artifactId: string) =>
    api.delete<ApiResponse<null>>(`/projects/${projectId}/artifacts/${artifactId}`),
};

// ============================================================
// Invoices API
// ============================================================

export const invoicesApi = {
  list: (params?: {
    client_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => api.get<PaginatedResponse<Invoice>>('/invoices', { params }),

  get: (id: string) => api.get<ApiResponse<Invoice>>(`/invoices/${id}`),

  create: (data: Partial<Invoice>) => api.post<ApiResponse<Invoice>>('/invoices', data),

  update: (id: string, data: Partial<Invoice>) =>
    api.put<ApiResponse<Invoice>>(`/invoices/${id}`, data),

  delete: (id: string) => api.delete<ApiResponse<null>>(`/invoices/${id}`),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<Invoice>>(`/invoices/${id}/status`, { status }),
};

export default api;
