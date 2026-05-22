import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';

export function useAuth() {
  const { accessToken, user, setAuth, clearAuth } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      if (res.data.success) {
        const { accessToken: token, user: u } = res.data.data;
        setAuth(token, u);
        navigate('/');
        addToast({ type: 'success', message: 'ログインしました' });
        return true;
      } else {
        addToast({ type: 'error', message: 'ログインに失敗しました' });
        return false;
      }
    },
    [setAuth, navigate, addToast],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore errors on logout
    }
    clearAuth();
    navigate('/login');
    addToast({ type: 'info', message: 'ログアウトしました' });
  }, [clearAuth, navigate, addToast]);

  const isAuthenticated = accessToken !== null;

  return { user, isAuthenticated, login, logout };
}
