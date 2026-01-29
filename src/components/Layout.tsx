import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Plus, FileText, Settings } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: '홈' },
    { path: '/add', icon: Plus, label: '기록' },
    { path: '/export', icon: FileText, label: '내보내기' },
    { path: '/settings', icon: Settings, label: '설정' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 메인 콘텐츠 */}
      <main className="max-w-2xl mx-auto">
        {children}
      </main>

      {/* 하단 네비게이션 (고정) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-4 gap-1">
            {navItems.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-col items-center justify-center min-h-[60px] py-2 transition-colors ${
                    isActive
                      ? 'text-brand'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={24} strokeWidth={2} />
                  <span className="text-xs mt-1 font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
