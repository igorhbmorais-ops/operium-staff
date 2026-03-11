import { useAuth } from '@/contexts/AuthContext';
import { Clock, CalendarDays, GraduationCap, Stethoscope, Bell, ArrowRight, AlertTriangle, Megaphone, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatTime, formatCurrency, formatDate } from '@/lib/utils';

export default function Home() {
  const { colaborador } = useAuth();
  const navigate = useNavigate();
  const [ultimoPonto, setUltimoPonto] = useState(null);
  const [registosHoje, setRegistosHoje] = useState([]);
  const [saldoFerias, setSaldoFerias] = useState(null);
  const [ultimoRecibo, setUltimoRecibo] = useState(null);
  const [horasFormacao, setHorasFormacao] = useState(0);
  const [proximoExame, setProximoExame] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [expandedAviso, setExpandedAviso] = useState(null);
  const [readAvisos, setReadAvisos] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('readAvisos') || '[]')); }
    catch { return new Set(); }
  });

  const markAsRead = (id) => {
    setReadAvisos(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('readAvisos', JSON.stringify([...next]));
      return next;
    });
    setExpandedAviso(id);
  };

  const unreadCount = avisos.filter(a => !readAvisos.has(a.id)).length;

  const primeiroNome = colaborador?.nome?.split(' ')[0] ?? 'Colaborador';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 19 ? 'Boa tarde' : 'Boa noite';
  const hoje = new Date().toISOString().slice(0, 10);
  const anoActual = new Date().getFullYear();

  useEffect(() => {
    if (!colaborador?.id) return;

    // Registos de ponto hoje
    supabase
      .from('ponto_registos')
      .select('tipo, hora')
      .eq('colaborador_id', colaborador.id)
      .eq('data', hoje)
      .order('hora', { ascending: true })
      .then(({ data }) => {
        setRegistosHoje(data ?? []);
        if (data?.length) setUltimoPonto(data[data.length - 1]);
      });

    // Saldo férias
    supabase
      .from('saldo_ferias')
      .select('dias_direito, dias_gozados, dias_marcados, dias_transitados')
      .eq('colaborador_id', colaborador.id)
      .eq('ano', anoActual)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const total = (data.dias_direito ?? 0) + (data.dias_transitados ?? 0);
          setSaldoFerias({
            disponiveis: total - (data.dias_gozados ?? 0) - (data.dias_marcados ?? 0),
          });
        }
      });

    // Último recibo
    supabase
      .from('recibos_salario')
      .select('liquido, ano, mes')
      .eq('colaborador_id', colaborador.id)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setUltimoRecibo(data[0]);
      });

    // Horas formação este ano
    supabase
      .from('formacao_sessoes')
      .select('horas, data_inicio')
      .eq('colaborador_id', colaborador.id)
      .then(({ data }) => {
        const total = (data ?? [])
          .filter(f => f.data_inicio && new Date(f.data_inicio).getFullYear() === anoActual)
          .reduce((sum, f) => sum + (Number(f.horas) || 0), 0);
        setHorasFormacao(total);
      });

    // Próximo exame
    supabase
      .from('exames_medicos')
      .select('proximo_exame')
      .eq('colaborador_id', colaborador.id)
      .not('proximo_exame', 'is', null)
      .order('proximo_exame', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]?.proximo_exame) {
          const diff = Math.ceil((new Date(data[0].proximo_exame) - new Date()) / 86400000);
          setProximoExame(diff > 0 ? diff : null);
        }
      });

    // Avisos recentes (últimos 5, publicados)
    supabase
      .from('avisos_staff')
      .select('*')
      .or(`data_publicacao.is.null,data_publicacao.lte.${hoje}`)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        // Filtrar por destinatários
        const filtered = (data ?? []).filter(a =>
          !a.destinatarios || a.destinatarios.includes(colaborador.id)
        );
        setAvisos(filtered);
      });
  }, [colaborador?.id]);

  const emTurno = ultimoPonto?.tipo === 'entrada';
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{saudacao}, {primeiroNome}</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button
          onClick={() => navigate('/avisos')}
          className="relative w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <Bell size={20} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Avisos recentes */}
      {avisos.length > 0 && (
        <div className="space-y-2">
          {avisos.slice(0, 5).map(aviso => (
            <button
              key={aviso.id}
              onClick={() => markAsRead(aviso.id)}
              className={`w-full text-left rounded-xl border shadow-sm p-3.5 transition-all active:scale-[0.99] ${
                aviso.prioridade === 'urgente'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg ${
                  aviso.prioridade === 'urgente'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-orange-100 text-orange-600'
                }`}>
                  {aviso.prioridade === 'urgente'
                    ? <AlertTriangle size={14} />
                    : <Megaphone size={14} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">{aviso.titulo}</p>
                    {aviso.prioridade === 'urgente' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase shrink-0">
                        Urgente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{aviso.mensagem}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {formatDate(aviso.data_publicacao || aviso.created_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {avisos.length > 5 && (
            <button
              onClick={() => navigate('/avisos')}
              className="w-full text-center text-xs text-orange-600 font-medium py-1.5 hover:text-orange-700"
            >
              Ver todos os avisos →
            </button>
          )}
        </div>
      )}

      {/* Modal Aviso */}
      {expandedAviso && (() => {
        const aviso = avisos.find(a => a.id === expandedAviso);
        if (!aviso) return null;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setExpandedAviso(null)}>
            <div
              className={`w-full max-w-md rounded-2xl shadow-xl p-5 space-y-3 ${
                aviso.prioridade === 'urgente' ? 'bg-red-50' : 'bg-white'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    aviso.prioridade === 'urgente'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-orange-100 text-orange-600'
                  }`}>
                    {aviso.prioridade === 'urgente'
                      ? <AlertTriangle size={18} />
                      : <Megaphone size={18} />
                    }
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{aviso.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {aviso.prioridade === 'urgente' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">
                          Urgente
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">
                        {formatDate(aviso.data_publicacao || aviso.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedAviso(null)}
                  className="p-1 rounded-full hover:bg-gray-200 text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className={`rounded-xl p-4 ${aviso.prioridade === 'urgente' ? 'bg-white/80' : 'bg-gray-50'}`}>
                <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                  {aviso.mensagem}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Card Ponto */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-blue-600" />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ponto de Hoje</h2>
        </div>

        <button
          onClick={() => navigate('/ponto')}
          className={`w-full flex items-center justify-between py-3.5 px-5 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] ${
            emTurno
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25'
              : 'bg-gradient-to-r from-green-500 to-green-600 shadow-lg shadow-green-500/25'
          }`}
        >
          <span>{emTurno ? 'Registar Saída' : 'Registar Entrada'}</span>
          <ArrowRight size={18} />
        </button>

        {ultimoPonto && (
          <p className="text-xs text-gray-400 mt-3">
            Último registo: {ultimoPonto.tipo} às {formatTime(ultimoPonto.hora)}
          </p>
        )}
      </div>

      {/* Grid 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        <InfoCard
          icon={CalendarDays}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Férias"
          value={saldoFerias ? `${saldoFerias.disponiveis}` : '—'}
          unit="dias disponíveis"
          onClick={() => navigate('/ferias')}
        />
        <InfoCard
          icon={Clock}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          label="Salário"
          value={ultimoRecibo ? formatCurrency(ultimoRecibo.liquido) : '—'}
          unit={ultimoRecibo ? `${meses[(ultimoRecibo.mes ?? 1) - 1]} ${ultimoRecibo.ano}` : ''}
          onClick={() => navigate('/documentos')}
        />
        <InfoCard
          icon={GraduationCap}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          label="Formação"
          value={`${horasFormacao}h`}
          unit="de 40h cumpridas"
          progress={Math.min(100, (horasFormacao / 40) * 100)}
          onClick={() => navigate('/documentos')}
        />
        <InfoCard
          icon={Stethoscope}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          label="Exame"
          value={proximoExame ? `${proximoExame}` : '—'}
          unit={proximoExame ? 'dias' : 'sem agendamento'}
          onClick={() => navigate('/documentos')}
        />
      </div>

      {/* Registos de Hoje */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Registos Hoje</h2>
        {registosHoje.length === 0 ? (
          <p className="text-sm text-gray-300">Sem registos hoje</p>
        ) : (
          <div className="space-y-2">
            {registosHoje.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${r.tipo === 'entrada' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-sm text-gray-700 capitalize">{r.tipo}</span>
                </div>
                <span className="text-sm text-gray-500 font-medium">{formatTime(r.hora)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, iconBg, iconColor, label, value, unit, progress, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center mb-2`}>
        <Icon size={16} className={iconColor} />
      </div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {progress !== undefined ? (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
          <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : (
        <p className="text-xs text-gray-400 mt-0.5">{unit}</p>
      )}
    </button>
  );
}
