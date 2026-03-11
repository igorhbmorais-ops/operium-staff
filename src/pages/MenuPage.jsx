import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, User, FileText, MessageSquare, Receipt, Clock, Shield, LogOut, ChevronRight, BookOpen, Megaphone } from 'lucide-react';

const sections = [
  {
    title: 'O Meu Perfil',
    items: [
      { label: 'Perfil', icon: User, path: '/perfil', desc: 'Dados pessoais e segurança' },
      { label: 'Notificações', icon: Bell, path: '/notificacoes', desc: 'Alertas e avisos' },
      { label: 'Recibos', icon: Receipt, path: '/documentos', desc: 'Recibos de vencimento' },
      { label: 'Horário', icon: Clock, path: '/horario', desc: 'Horário de trabalho' },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { label: 'Avisos', icon: Megaphone, path: '/avisos', desc: 'Lembretes e avisos da empresa' },
      { label: 'Mensagens', icon: MessageSquare, path: '/mensagens', desc: 'Chat com gestor' },
      { label: 'Despesas', icon: FileText, path: '/despesas', desc: 'Submeter reembolsos', perm: 'despesas' },
    ],
  },
  {
    title: 'Empresa',
    items: [
      { label: 'Regulamento', icon: BookOpen, path: '/regulamento', desc: 'Documentos da empresa' },
      { label: 'Denúncia', icon: Shield, path: '/denuncia', desc: 'Reportar situação' },
    ],
  },
];

export default function MenuPage() {
  const { colaborador, logout, refreshColaborador } = useAuth();
  const navigate = useNavigate();

  // Re-fetch permissões ao abrir o menu
  useEffect(() => {
    if (colaborador?.id) refreshColaborador();
  }, []);

  const nome = colaborador?.nome ?? 'Colaborador';
  const iniciais = nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const perms = colaborador?.permissoes || {};

  return (
    <div className="p-4 pb-24 space-y-5">
      {/* Header com avatar */}
      <div className="flex items-center gap-4 py-2">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="text-white font-bold text-lg">{iniciais}</span>
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{nome}</p>
          <p className="text-sm text-gray-500">{colaborador?.categoria ?? 'Colaborador'}</p>
        </div>
      </div>

      {/* Grouped sections */}
      {sections.map(({ title, items }) => {
        // Filtrar items por permissões
        const visibleItems = items.filter(item =>
          !item.perm || perms[item.perm] === true
        );
        if (visibleItems.length === 0) return null;
        return (
          <div key={title}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{title}</h3>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {visibleItems.map(({ label, icon: Icon, path, desc }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors active:bg-gray-100"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-medium py-3.5 rounded-xl hover:bg-red-100 transition-colors"
      >
        <LogOut size={18} /> Terminar Sessão
      </button>

      <p className="text-center text-xs text-gray-300 pt-1">
        Operium Staff · v1.0
      </p>
    </div>
  );
}
