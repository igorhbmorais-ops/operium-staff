import { NavLink } from 'react-router-dom';
import { Home, Clock, CalendarDays, FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', label: 'Início', icon: Home },
  { path: '/ponto', label: 'Ponto', icon: Clock },
  { path: '/ferias', label: 'Férias', icon: CalendarDays },
  { path: '/recibos', label: 'Recibos', icon: FileText },
  { path: '/perfil', label: 'Perfil', icon: User },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors',
              isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
