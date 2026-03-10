import { useAuth } from '@/contexts/AuthContext';
import { Clock, CalendarDays, FileText, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/lib/utils';

export default function Home() {
  const { colaborador } = useAuth();
  const navigate = useNavigate();
  const [ultimoPonto, setUltimoPonto] = useState(null);
  const [saldoFerias, setSaldoFerias] = useState(null);

  const primeiroNome = colaborador?.nome?.split(' ')[0] ?? 'Colaborador';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 19 ? 'Boa tarde' : 'Boa noite';

  useEffect(() => {
    if (!colaborador?.id) return;

    // Último registo de ponto
    supabase
      .from('ponto_registos')
      .select('tipo, data_hora')
      .eq('colaborador_id', colaborador.id)
      .order('data_hora', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setUltimoPonto(data[0]);
      });

    // Saldo de férias
    supabase
      .from('saldo_ferias')
      .select('dias_disponiveis, dias_gozados, dias_totais')
      .eq('colaborador_id', colaborador.id)
      .eq('ano', new Date().getFullYear())
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSaldoFerias(data);
      });
  }, [colaborador?.id]);

  const quickActions = [
    { label: 'Registar Ponto', icon: Clock, color: 'bg-blue-500', path: '/ponto' },
    { label: 'Férias', icon: CalendarDays, color: 'bg-green-500', path: '/ferias' },
    { label: 'Recibos', icon: FileText, color: 'bg-purple-500', path: '/recibos' },
    { label: 'Notificações', icon: Bell, color: 'bg-orange-500', path: '/notificacoes' },
  ];

  return (
    <div className="p-4 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{saudacao}, {primeiroNome}</h1>
        <p className="text-sm text-gray-500 mt-1">{colaborador?.categoria ?? 'Colaborador'}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map(({ label, icon: Icon, color, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className={`${color} p-2.5 rounded-lg`}>
              <Icon size={20} className="text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </button>
        ))}
      </div>

      {/* Estado do Ponto */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Ponto Hoje</h2>
        {ultimoPonto ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {ultimoPonto.tipo === 'entrada' ? 'Em serviço' : 'Saída registada'}
              </p>
              <p className="text-sm text-gray-500">
                Último registo: {formatTime(ultimoPonto.data_hora)}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${ultimoPonto.tipo === 'entrada' ? 'bg-green-500' : 'bg-gray-300'}`} />
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Sem registos hoje</p>
        )}
      </div>

      {/* Saldo Férias */}
      {saldoFerias && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Férias {new Date().getFullYear()}</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">{saldoFerias.dias_disponiveis}</p>
              <p className="text-xs text-gray-500">dias disponíveis</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{saldoFerias.dias_gozados} gozados</p>
              <p>{saldoFerias.dias_totais} total</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
