import { useEffect } from 'react';
import { useToastStore } from '../../stores/toastStore';

const typeStyles: Record<string, string> = {
  success: 'bg-emerald-600/95 border-emerald-500',
  error: 'bg-red-600/95 border-red-500',
  warning: 'bg-amber-600/95 border-amber-500',
  info: 'bg-brand-600/95 border-brand-500',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  useEffect(() => {
    const timers = toasts.map((t) =>
      setTimeout(() => removeToast(t.id), t.duration ?? 4000),
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, removeToast]);

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={[
            'border rounded-lg px-4 py-3 text-sm text-white shadow-2xl',
            'animate-in slide-in-from-right-2 duration-150',
            typeStyles[t.type] ?? typeStyles['info'],
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="flex-1 leading-relaxed">{t.message}</p>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              aria-label="閉じる"
              className="text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
