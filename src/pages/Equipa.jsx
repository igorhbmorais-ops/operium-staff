// Equipa.jsx — V9 Fase 6 — Gestão de equipa para cargos nível 2
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import {
  Users, CalendarDays, Receipt, Clock, Loader2, Check, X,
  ChevronRight, AlertCircle, User,
} from 'lucide-react';
import { formatDate, formatTime, formatCurrency } from '@/lib/utils';

// ─── Tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: Users },
  { id: 'ferias', label: 'Férias', icon: CalendarDays },
  { id: 'despesas', label: 'Despesas', icon: Receipt },
  { id: 'ponto', label: 'Ponto', icon: Clock },
];

// ─── Hook: subordinados ──────────────────────────────────────────────────────

function useSubordinados(colaborador) {
  const [subordinados, setSubordinados] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!colaborador?.cargo_id || !colaborador?.empresa_id) {
      setLoading(false);
      return;
    }

    // Buscar cargos cujo superior_id = meu cargo_id
    const { data: cargosFilho } = await supabase
      .from('cargos')
      .select('id')
      .eq('superior_id', colaborador.cargo_id)
      .eq('empresa_id', colaborador.empresa_id);

    const cargoIds = (cargosFilho ?? []).map(c => c.id);
    if (cargoIds.length === 0) {
      setSubordinados([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('colaboradores')
      .select('id, nome, email, categoria, cargo_id, cargo:cargos(nome)')
      .eq('empresa_id', colaborador.empresa_id)
      .in('cargo_id', cargoIds)
      .eq('activo', true)
      .order('nome');

    setSubordinados(data ?? []);
    setLoading(false);
  }, [colaborador?.cargo_id, colaborador?.empresa_id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { subordinados, loading, refresh: fetch };
}

// ─── Tab Resumo ──────────────────────────────────────────────────────────────

function TabResumo({ subordinados, pendenciasFerias, pendenciasDespesas }) {
  return (
    <div className="space-y-4">
      {/* Pendências */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <CalendarDays size={20} className="mx-auto text-blue-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{pendenciasFerias}</p>
          <p className="text-xs text-gray-400">Férias pendentes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Receipt size={20} className="mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{pendenciasDespesas}</p>
          <p className="text-xs text-gray-400">Despesas pendentes</p>
        </div>
      </div>

      {/* Lista de subordinados */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-50">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Equipa ({subordinados.length})
          </h2>
        </div>
        {subordinados.length === 0 ? (
          <div className="p-8 text-center">
            <Users size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Sem subordinados directos</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {subordinados.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <User size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.nome}</p>
                  <p className="text-xs text-gray-400">{s.cargo?.nome || s.categoria || 'Colaborador'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Férias ──────────────────────────────────────────────────────────────

function TabFerias({ subordinadoIds, onAction }) {
  const toast = useToast();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (subordinadoIds.length === 0) { setLoading(false); return; }
    fetchPedidos();
  }, [subordinadoIds]);

  async function fetchPedidos() {
    const { data } = await supabase
      .from('pedidos_ferias')
      .select('*, colaborador:colaboradores(nome)')
      .in('colaborador_id', subordinadoIds)
      .order('created_at', { ascending: false });
    setPedidos(data ?? []);
    setLoading(false);
  }

  async function handleAction(pedidoId, estado) {
    setActionLoading(pedidoId);
    const { error } = await supabase
      .from('pedidos_ferias')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', pedidoId);

    if (!error) {
      toast(estado === 'aprovado' ? 'Férias aprovadas' : 'Férias recusadas', 'success');
      await fetchPedidos();
      onAction?.();
    } else {
      toast('Erro ao processar pedido', 'error');
    }
    setActionLoading(null);
  }

  const statusConfig = {
    pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
    aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
    recusado: { label: 'Recusado', color: 'bg-red-100 text-red-700' },
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>;

  const pendentes = pedidos.filter(p => p.estado === 'pendente');
  const outros = pedidos.filter(p => p.estado !== 'pendente');

  return (
    <div className="space-y-4">
      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
            Por Aprovar ({pendentes.length})
          </h3>
          <div className="space-y-2">
            {pendentes.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-yellow-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.colaborador?.nome || 'Colaborador'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(p.data_inicio)} — {formatDate(p.data_fim)}
                      {p.dias_uteis && <span className="ml-1">({p.dias_uteis} dias)</span>}
                    </p>
                    {p.notas && <p className="text-xs text-gray-400 mt-1">{p.notas}</p>}
                  </div>
                  <AlertCircle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAction(p.id, 'aprovado')}
                    disabled={actionLoading === p.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    <Check size={14} /> Aprovar
                  </button>
                  <button
                    onClick={() => handleAction(p.id, 'recusado')}
                    disabled={actionLoading === p.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                  >
                    <X size={14} /> Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
          Histórico
        </h3>
        {outros.length === 0 && pendentes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <CalendarDays size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Sem pedidos de férias da equipa</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {outros.map(p => {
              const status = statusConfig[p.estado] ?? { label: p.estado, color: 'bg-gray-100 text-gray-600' };
              return (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{p.colaborador?.nome}</p>
                    <p className="text-xs text-gray-400">{formatDate(p.data_inicio)} — {formatDate(p.data_fim)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Despesas ────────────────────────────────────────────────────────────

function TabDespesas({ subordinadoIds, onAction }) {
  const toast = useToast();
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (subordinadoIds.length === 0) { setLoading(false); return; }
    fetchDespesas();
  }, [subordinadoIds]);

  async function fetchDespesas() {
    const { data } = await supabase
      .from('despesas_colaborador')
      .select('*, colaborador:colaboradores(nome)')
      .in('colaborador_id', subordinadoIds)
      .order('created_at', { ascending: false });
    setDespesas(data ?? []);
    setLoading(false);
  }

  async function handleAction(despesaId, estado) {
    setActionLoading(despesaId);
    const updateData = { estado, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from('despesas_colaborador')
      .update(updateData)
      .eq('id', despesaId);

    if (!error) {
      toast(estado === 'aprovada' ? 'Despesa aprovada' : 'Despesa rejeitada', 'success');
      await fetchDespesas();
      onAction?.();
    } else {
      toast('Erro ao processar despesa', 'error');
    }
    setActionLoading(null);
  }

  const statusConfig = {
    pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
    aprovada: { label: 'Aprovada', color: 'bg-green-100 text-green-700' },
    rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-700' },
    paga: { label: 'Paga', color: 'bg-blue-100 text-blue-700' },
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>;

  const pendentes = despesas.filter(d => d.estado === 'pendente');
  const outros = despesas.filter(d => d.estado !== 'pendente');

  return (
    <div className="space-y-4">
      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
            Por Aprovar ({pendentes.length})
          </h3>
          <div className="space-y-2">
            {pendentes.map(d => (
              <div key={d.id} className="bg-white rounded-xl border border-yellow-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{d.colaborador?.nome}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(d.valor)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{d.descricao}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="capitalize">{d.categoria}</span> · {formatDate(d.data)}
                    </p>
                  </div>
                  <AlertCircle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAction(d.id, 'aprovada')}
                    disabled={actionLoading === d.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    <Check size={14} /> Aprovar
                  </button>
                  <button
                    onClick={() => handleAction(d.id, 'rejeitada')}
                    disabled={actionLoading === d.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition disabled:opacity-50"
                  >
                    <X size={14} /> Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
          Histórico
        </h3>
        {outros.length === 0 && pendentes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <Receipt size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Sem despesas da equipa</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {outros.map(d => {
              const status = statusConfig[d.estado] ?? { label: d.estado, color: 'bg-gray-100 text-gray-600' };
              return (
                <div key={d.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{d.colaborador?.nome}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(d.valor)} · {d.descricao}</p>
                    <p className="text-xs text-gray-400">{formatDate(d.data)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Ponto ───────────────────────────────────────────────────────────────

function TabPonto({ subordinados }) {
  const [registos, setRegistos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSel, setDataSel] = useState(new Date().toISOString().slice(0, 10));

  const subordinadoIds = subordinados.map(s => s.id);

  useEffect(() => {
    if (subordinadoIds.length === 0) { setLoading(false); return; }
    fetchRegistos();
  }, [subordinadoIds.join(','), dataSel]);

  async function fetchRegistos() {
    setLoading(true);
    const { data } = await supabase
      .from('ponto_registos')
      .select('colaborador_id, tipo, hora')
      .in('colaborador_id', subordinadoIds)
      .eq('data', dataSel)
      .order('hora', { ascending: true });

    setRegistos(data ?? []);
    setLoading(false);
  }

  // Agrupar por colaborador
  const porColaborador = {};
  subordinados.forEach(s => { porColaborador[s.id] = { nome: s.nome, registos: [] }; });
  registos.forEach(r => {
    if (porColaborador[r.colaborador_id]) {
      porColaborador[r.colaborador_id].registos.push(r);
    }
  });

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500">Data:</label>
        <input
          type="date"
          value={dataSel}
          onChange={e => setDataSel(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : subordinados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <Clock size={32} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">Sem subordinados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(porColaborador).map(([colabId, info]) => {
            const entradas = info.registos.filter(r => r.tipo === 'entrada');
            const saidas = info.registos.filter(r => r.tipo === 'saida');
            const emTurno = info.registos.length > 0 && info.registos[info.registos.length - 1].tipo === 'entrada';

            return (
              <div key={colabId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${emTurno ? 'bg-green-500' : info.registos.length > 0 ? 'bg-gray-400' : 'bg-red-300'}`} />
                    <p className="text-sm font-medium text-gray-800">{info.nome}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    emTurno ? 'bg-green-100 text-green-700' :
                    info.registos.length > 0 ? 'bg-gray-100 text-gray-600' :
                    'bg-red-50 text-red-500'
                  }`}>
                    {emTurno ? 'Em turno' : info.registos.length > 0 ? 'Saiu' : 'Sem registo'}
                  </span>
                </div>
                {info.registos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {info.registos.map((r, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded ${
                        r.tipo === 'entrada' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {r.tipo === 'entrada' ? '→' : '←'} {formatTime(r.hora)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Equipa() {
  const { colaborador } = useAuth();
  const [tab, setTab] = useState('resumo');
  const [pendenciasFerias, setPendenciasFerias] = useState(0);
  const [pendenciasDespesas, setPendenciasDespesas] = useState(0);
  const { subordinados, loading } = useSubordinados(colaborador);

  const subordinadoIds = subordinados.map(s => s.id);

  // Contar pendências
  useEffect(() => {
    if (subordinadoIds.length === 0) return;

    supabase
      .from('pedidos_ferias')
      .select('id', { count: 'exact', head: true })
      .in('colaborador_id', subordinadoIds)
      .eq('estado', 'pendente')
      .then(({ count }) => setPendenciasFerias(count ?? 0));

    supabase
      .from('despesas_colaborador')
      .select('id', { count: 'exact', head: true })
      .in('colaborador_id', subordinadoIds)
      .eq('estado', 'pendente')
      .then(({ count }) => setPendenciasDespesas(count ?? 0));
  }, [subordinadoIds.join(',')]);

  const refreshPendencias = () => {
    if (subordinadoIds.length === 0) return;
    supabase
      .from('pedidos_ferias')
      .select('id', { count: 'exact', head: true })
      .in('colaborador_id', subordinadoIds)
      .eq('estado', 'pendente')
      .then(({ count }) => setPendenciasFerias(count ?? 0));
    supabase
      .from('despesas_colaborador')
      .select('id', { count: 'exact', head: true })
      .in('colaborador_id', subordinadoIds)
      .eq('estado', 'pendente')
      .then(({ count }) => setPendenciasDespesas(count ?? 0));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  const totalPendencias = pendenciasFerias + pendenciasDespesas;

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipa</h1>
        <p className="text-sm text-gray-500">
          {subordinados.length} subordinado{subordinados.length !== 1 ? 's' : ''}
          {totalPendencias > 0 && (
            <span className="ml-2 text-yellow-600 font-medium">
              · {totalPendencias} pendência{totalPendencias !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          const badge = t.id === 'ferias' ? pendenciasFerias :
                        t.id === 'despesas' ? pendenciasDespesas : 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition relative ${
                isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{t.label}</span>
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tab === 'resumo' && (
        <TabResumo
          subordinados={subordinados}
          pendenciasFerias={pendenciasFerias}
          pendenciasDespesas={pendenciasDespesas}
        />
      )}
      {tab === 'ferias' && (
        <TabFerias subordinadoIds={subordinadoIds} onAction={refreshPendencias} />
      )}
      {tab === 'despesas' && (
        <TabDespesas subordinadoIds={subordinadoIds} onAction={refreshPendencias} />
      )}
      {tab === 'ponto' && (
        <TabPonto subordinados={subordinados} />
      )}
    </div>
  );
}
