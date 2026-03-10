import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, User, FileText, MessageSquare, Receipt, Clock, Shield, LogOut, ChevronRight } from 'lucide-react';

export default function MenuPage() {
  const { colaborador, logout } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { label: 'Perfil', icon: User, path: '/perfil', desc: 'Dados pessoais e configurações' },
    { label: 'Notificações', icon: Bell, path: '/notificacoes', desc: 'Alertas e avisos' },
    { label: 'Recibos', icon: Receipt, path: '/documentos', desc: 'Recibos de vencimento' },
    { label: 'Horário', icon: Clock, path: '/horario', desc: 'Horário de trabalho', soon: true },
    { label: 'Despesas', icon: FileText, path: '/despesas', desc: 'Submeter reembolsos', soon: true },
    { label: 'Mensagens', icon: MessageSquare, path: '/mensagens', desc: 'Chat com gestor', soon: true },
    { label: 'Denúncia', icon: Shield, path: '/denuncia', desc: 'Reportar situação', soon: true },
  ];

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <User size={22} className="text-blue-600" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{colaborador?.nome ?? 'Colaborador'}</p>
          <p className="text-xs text-gray-500">{colaborador?.categoria ?? ''}</p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {menuItems.map(({ label, icon: Icon, path, desc, soon }) => (
          <button
            key={path}
            onClick={() => !soon && navigate(path)}
            disabled={soon}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                {soon && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Em breve</span>
                )}
              </div>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-medium py-3.5 rounded-xl hover:bg-red-100 transition-colors"
      >
        <LogOut size={18} /> Terminar Sessão
      </button>

      <p className="text-center text-xs text-gray-300 pt-2">
        Operium Staff · v1.0
      </p>
    </div>
  );
}
