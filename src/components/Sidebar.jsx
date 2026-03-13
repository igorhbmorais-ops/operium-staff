import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  User, CalendarDays, BarChart3, MessageSquare, GraduationCap,
  Stethoscope, Shield, Wallet, BookOpen, Clock, Settings, LogOut,
  Users, X, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { label: 'Perfil', icon: User, path: '/perfil' },
  { label: 'Férias', icon: CalendarDays, path: '/ferias' },
  { label: 'Avaliações', icon: BarChart3, path: '/avaliacoes' },
  { label: 'Mensagens', icon: MessageSquare, path: '/mensagens' },
  { label: 'Formações', icon: GraduationCap, path: '/documentos' },
  { label: 'Medicina / Exames', icon: Stethoscope, path: '/documentos' },
  { label: 'Denúncias', icon: Shield, path: '/denuncia' },
  { label: 'Despesas', icon: Wallet, path: '/despesas', perm: 'despesas' },
  { label: 'Regulamento Interno', icon: BookOpen, path: '/regulamento' },
  { label: 'Horários', icon: Clock, path: '/horario' },
];

const bottomItems = [
  { label: 'Definições', icon: Settings, path: '/notificacoes' },
];

const gestaoItems = [
  { label: 'Equipa', icon: Users, path: '/equipa' },
];

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { colaborador, logout } = useAuth();
  const backdropRef = useRef(null);
  const startX = useRef(null);

  const nome = colaborador?.nome ?? 'Colaborador';
  const iniciais = nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const cargo = colaborador?.cargo?.nome ?? colaborador?.categoria ?? 'Colaborador';
  const perms = colaborador?.permissoes || {};
  const isGestor = colaborador?.cargo?.nivel != null && colaborador.cargo.nivel <= 2;

  // Close on navigation
  useEffect(() => {
    if (open) onClose();
  }, [location.pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Swipe to close
  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (startX.current === null) return;
    const diff = e.changedTouches[0].clientX - startX.current;
    if (diff < -80) onClose();
    startX.current = null;
  };

  const go = (path) => {
    navigate(path);
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  const visibleMenuItems = menuItems.filter(item => {
    if (item.perm && perms[item.perm] !== true) return false;
    return true;
  });

  return (
    <>
      {/* Overlay */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className={cn(
          'fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      />

      {/* Sidebar Panel */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'fixed top-0 left-0 bottom-0 w-[280px] bg-gray-900 z-[70] flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header: Avatar + Name */}
        <div className="p-5 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">{iniciais}</span>
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{nome}</p>
                <p className="text-gray-400 text-xs truncate">{cargo}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable menu */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {visibleMenuItems.map(({ label, icon: Icon, path }) => {
            const active = location.pathname === path;
            return (
              <button
                key={label}
                onClick={() => go(path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )}
              >
                <Icon size={18} className={active ? 'text-blue-400' : 'text-gray-500'} />
                <span className="flex-1 text-left">{label}</span>
                <ChevronRight size={14} className="text-gray-600" />
              </button>
            );
          })}

          {/* Gestao section */}
          {isGestor && (
            <>
              <div className="h-px bg-gray-800 my-3" />
              <p className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Gestão</p>
              {gestaoItems.map(({ label, icon: Icon, path }) => {
                const active = location.pathname === path;
                return (
                  <button
                    key={label}
                    onClick={() => go(path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    )}
                  >
                    <Icon size={18} className={active ? 'text-blue-400' : 'text-gray-500'} />
                    <span className="flex-1 text-left">{label}</span>
                    <ChevronRight size={14} className="text-gray-600" />
                  </button>
                );
              })}
            </>
          )}

          {/* Divider + bottom items */}
          <div className="h-px bg-gray-800 my-3" />
          {bottomItems.map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              onClick={() => go(path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Icon size={18} className="text-gray-500" />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
          <p className="text-center text-[10px] text-gray-600 mt-2">Operium Staff v1.1</p>
        </div>
      </div>
    </>
  );
}
