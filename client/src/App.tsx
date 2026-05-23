import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from './stores/authStore';
import { authApi } from './lib/api';
import { Layout } from './components/layout/Layout';
import { Spinner } from './components/ui/Spinner';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ClientList } from './pages/clients/ClientList';
import { ClientDetail } from './pages/clients/ClientDetail';
import { ProjectList } from './pages/projects/ProjectList';
import { ProjectDetail } from './pages/projects/ProjectDetail';
import { TaskDetail } from './pages/tasks/TaskDetail';
import { ToolRegistry } from './pages/tools/ToolRegistry';
import { TemplateList } from './pages/templates/TemplateList';
import { ActivityLogPage } from './pages/activity/ActivityLog';
import { BillingList } from './pages/billing/BillingList';
import { CalendarPage } from './pages/calendar/CalendarPage';
import { KpiDashboard } from './pages/kpi/KpiDashboard';
import { ResourcePlanningPage } from './pages/resources/ResourcePlanningPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import type { ApiResponse } from './types';

function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  const [hydrating, setHydrating] = useState(true);
  const setAuth = useAuthStore((s) => s.setAuth);

  // On app load: silent refresh + fetch user profile so reload preserves session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refreshRes = await axios.post<ApiResponse<{ accessToken: string }>>(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        );
        if (cancelled || !refreshRes.data.success) {
          if (!cancelled) setHydrating(false);
          return;
        }
        useAuthStore.getState().updateToken(refreshRes.data.data.accessToken);

        const meRes = await authApi.me();
        if (!cancelled && meRes.data.success) {
          useAuthStore.getState().setAuth(refreshRes.data.data.accessToken, meRes.data.data);
        }
      } catch {
        // No valid refresh token — stay logged out
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAuth]);

  if (hydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/tools" element={<ToolRegistry />} />
            <Route path="/templates" element={<TemplateList />} />
            <Route path="/activity" element={<ActivityLogPage />} />
            <Route path="/billing" element={<BillingList />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/kpi" element={<KpiDashboard />} />
            <Route path="/resources" element={<ResourcePlanningPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
