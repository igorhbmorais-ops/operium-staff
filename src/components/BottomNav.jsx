import { NavLink, useLocation } from 'react-router-dom';
import { Home, FolderOpen, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', label: 'Início', icon: Home },
  { path: '/documentos', label: 'Docs', icon: FolderOpen },
  { path: '__menu__', label: 'Menu', icon: Menu },
];

export default function BottomNav({ onMenuClick, pendingCount = 0 }) {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ path, label, icon: Icon }) => {
          if (path === '__menu__') {
            return (
              <button
                key={path}
                onClick={onMenuClick}
                className="flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-all duration-200"
              >
                <Icon size={22} strokeWidth={2} />
                <span>{label}</span>
              </button>
            );
          }

          const isActive = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);

          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-all duration-200',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span>{label}</span>
              {path === '/' && pendingCount > 0 && (
                <span className="absolute -top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
