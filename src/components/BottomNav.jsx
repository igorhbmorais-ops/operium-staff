import { NavLink, useLocation } from 'react-router-dom';
import { Home, Clock, CalendarDays, FolderOpen, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', label: 'Início', icon: Home },
  { path: '/ponto', label: 'Ponto', icon: Clock },
  { path: '/ferias', label: 'Férias', icon: CalendarDays },
  { path: '/documentos', label: 'Docs', icon: FolderOpen },
  { path: '/menu', label: 'Menu', icon: Menu },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ path, label, icon: Icon }) => {
          const isActive = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);

          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-all duration-200',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
