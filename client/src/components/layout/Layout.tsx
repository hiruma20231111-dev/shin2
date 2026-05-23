import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToolStatusBanner } from './ToolStatusBanner';
import { ToastContainer } from '../ui/Toast';
import { useHealthPolling } from '../../hooks/useHealthPolling';

const pageTitles: Record<string, string> = {
  '/': 'ダッシュボード',
  '/clients': 'クライアント',
  '/projects': 'プロジェクト',
  '/tools': 'ツールレジストリ',
  '/templates': 'テンプレート',
  '/billing': '請求管理',
  '/activity': 'アクティビティログ',
  '/calendar': 'カレンダー',
  '/kpi': 'KPI ダッシュボード',
  '/resources': 'リソース計画',
  '/settings': '設定',
};

function findTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length > 0) {
    const root = `/${segs[0]}`;
    return pageTitles[root] ?? '';
  }
  return '';
}

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export function Layout() {
  const location = useLocation();
  useHealthPolling();

  useEffect(() => {
    document.title = `${findTitle(location.pathname)} | ハブワークスペース`;
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-surface-800 text-gray-100">
      <Sidebar />
      <div className="ml-60 min-h-screen flex flex-col">
        <Header title={findTitle(location.pathname)} />
        <ToolStatusBanner />
        <main className="flex-1 p-6 overflow-x-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
