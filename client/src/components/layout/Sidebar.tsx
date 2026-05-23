import { NavLink } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  group: string;
}

const navItems: NavItem[] = [
  { to: '/', label: 'ダッシュボード', icon: '◉', group: 'main' },
  { to: '/clients', label: 'クライアント', icon: '◆', group: 'main' },
  { to: '/projects', label: 'プロジェクト', icon: '▤', group: 'main' },
  { to: '/calendar', label: 'カレンダー', icon: '📅', group: 'plan' },
  { to: '/kpi', label: 'KPI', icon: '📊', group: 'plan' },
  { to: '/resources', label: 'リソース計画', icon: '🗂', group: 'plan' },
  { to: '/tools', label: 'ツール', icon: '⚙', group: 'system' },
  { to: '/templates', label: 'テンプレート', icon: '✎', group: 'system' },
  { to: '/billing', label: '請求管理', icon: '¥', group: 'system' },
  { to: '/activity', label: 'アクティビティ', icon: '⏱', group: 'system' },
  { to: '/settings', label: '設定', icon: '🔑', group: 'system' },
];

const groups = [
  { key: 'main', label: 'メイン' },
  { key: 'plan', label: '計画' },
  { key: 'system', label: 'システム' },
];

export function Sidebar() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-surface-900 border-r border-surface-700 flex flex-col">
      <div className="px-6 py-5 border-b border-surface-700">
        <h1 className="text-xl font-bold tracking-tight text-gray-100">
          <span className="text-brand-400">HUB</span>
          <span className="text-xs font-medium text-gray-500 ml-2">WORKSPACE</span>
        </h1>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide">
        {groups.map((group) => {
          const items = navItems.filter((i) => i.group === group.key);
          return (
            <div key={group.key} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-gray-600 uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        [
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                          isActive
                            ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30 shadow-sm'
                            : 'text-gray-400 hover:text-gray-100 hover:bg-surface-800',
                        ].join(' ')
                      }
                    >
                      <span className="text-base w-5 text-center shrink-0" aria-hidden>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-surface-700">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-100 hover:bg-surface-800 transition-colors"
        >
          <span className="text-base w-5 text-center" aria-hidden>
            {theme === 'dark' ? '☾' : '☀'}
          </span>
          <span>{theme === 'dark' ? 'ライトモード' : 'ダークモード'}</span>
        </button>
      </div>
    </aside>
  );
}
