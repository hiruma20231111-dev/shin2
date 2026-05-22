import { useState } from 'react';
import { useToolStatusStore } from '../../stores/toolStatusStore';

export function ToolStatusBanner() {
  const offline = useToolStatusStore((s) => s.offlineTools);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || offline.length === 0) return null;

  const hasOffline = offline.some((t) => t.status === 'offline');
  const styleClass = hasOffline
    ? 'bg-red-900/40 border-red-700 text-red-100'
    : 'bg-amber-900/40 border-amber-700 text-amber-100';

  return (
    <div
      role="alert"
      className={`border-l-4 ${styleClass} px-4 py-3 mx-6 mt-4 rounded-md flex items-center justify-between text-sm`}
    >
      <div>
        <span className="font-semibold">ツール稼働警告:</span>{' '}
        {offline.map((t, i) => (
          <span key={t.identifier}>
            {i > 0 && '、'}
            {t.name}（{t.status === 'offline' ? 'オフライン' : '低下'}）
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="バナーを閉じる"
        className="opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
