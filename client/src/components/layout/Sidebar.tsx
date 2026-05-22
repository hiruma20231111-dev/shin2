import { NavLink } from 'react-router-dom';
import { useThemeStore } from '../../stores/themeStore';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: '/', label: 'ダッシュボード', icon: '◉' },
  { to: '/clients', label: 'クライアント', icon: '◆' },
  { to: '/projects', label: 'プロジェクト', icon: '▤' },
  { to: '/tools', label: 'ツール', icon: '⚙' },
  { to: '/templates', label: 'テンプレート', icon: '✎' },
  { to: '/billing', label: '請求管理', icon: '¥' },
  { to: '/activity', label: 'アクティビティ', icon: '⏱' },
];

export function Sidebar() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-surface-900 border-r border-surface-700 flex flex-col">
      <div className="px-6 py-5 border-b border-surface-700">
        <h1 className="text-2xl font-bold tracking-tight text-gray-100">
          <span className="text-brand-500">HUB</span>
          <span className="text-xs font-medium text-gray-400 ml-2">WORKSPACE</span>
        </h1>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-600/30'
                      : 'text-gray-300 hover:text-gray-100 hover:bg-surface-800',
                  ].join(' ')
                }
              >
                <span className="text-base w-5 text-center" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-3 py-3 border-t border-surface-700">
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-gray-100 hover:bg-surface-800 transition-colors"
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
