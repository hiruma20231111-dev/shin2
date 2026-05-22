import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/authStore';

export function Login() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accessToken) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ok = await login(email, password);
      if (!ok) setError('メールアドレスまたはパスワードが正しくありません');
    } catch {
      setError('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900 p-6">
      <div className="w-full max-w-md bg-surface-800 border border-surface-600 rounded-2xl shadow-2xl p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-100">
            <span className="text-brand-500">HUB</span>{' '}
            <span className="text-gray-300 text-sm font-medium">WORKSPACE</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">運用者ログイン</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="メールアドレス"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            ログイン
          </Button>
        </form>
      </div>
    </div>
  );
}
