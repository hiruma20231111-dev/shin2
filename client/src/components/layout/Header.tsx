import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-14 bg-surface-900/60 backdrop-blur border-b border-surface-700 flex items-center justify-between px-6">
      <h2 className="text-base font-semibold text-gray-100">{title ?? ''}</h2>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-800 text-sm text-gray-200"
        >
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold">
            {user?.name?.charAt(0) ?? 'U'}
          </div>
          <span>{user?.name ?? 'ユーザー'}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-surface-800 border border-surface-600 rounded-lg shadow-xl py-1 z-50">
            <div className="px-3 py-2 text-xs text-gray-400 border-b border-surface-700">
              {user?.email}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-surface-700"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
