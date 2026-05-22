import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from './stores/authStore';
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
import type { ApiResponse } from './types';

function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  const [hydrating, setHydrating] = useState(true);
  const setAuth = useAuthStore((s) => s.setAuth);

  // On app load, attempt silent refresh to recover session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.post<ApiResponse<{ accessToken: string }>>(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        );
        if (!cancelled && res.data.success) {
          // We need user info too — call a profile endpoint or rely on a follow-up
          // For now, set token; user info will be missing until login form is filled
          // Better: have refresh also return user. For now keep simple.
          useAuthStore.getState().updateToken(res.data.data.accessToken);
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
