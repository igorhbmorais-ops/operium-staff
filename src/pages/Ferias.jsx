import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { CalendarDays, Plus, Loader2, Palmtree, X, Clock, CheckCircle, AlertTriangle, Sun } from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Feriados nacionais PT 2026 (fallback se tabela feriados nao existir)
const FERIADOS_FALLBACK = [
  '2026-01-01', '2026-04-03', '2026-04-05', '2026-04-25', '2026-05-01',
  '2026-06-04', '2026-06-10', '2026-08-15', '2026-10-05', '2026-11-01',
  '2026-12-01', '2026-12-08', '2026-12-25',
];

export default function Ferias() {
  const { colaborador } = useAuth();
  const toast = useToast();
  const [saldo, setSaldo] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const ano = new Date().getFullYear();

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchData();
    fetchFeriados();
  }, [colaborador?.id]);

  async function fetchFeriados() {
    const { data } = await supabase
      .from('feriados')
      .select('data, nome')
      .eq('ano', ano)
      .order('data');
    setFeriados(data || []);
  }

  const feriadoSet = useMemo(() => {
    if (feriados.length > 0) return new Set(feriados.map(f => f.data));
    return new Set(FERIADOS_FALLBACK);
  }, [feriados]);

  const feriadoNomes = useMemo(() => {
    const map = {};
    for (const f of feriados) map[f.data] = f.nome;
    return map;
  }, [feriados]);

  async function fetchData() {
    setPageLoading(true);
    const [saldoRes, pedidosRes] = await Promise.all([
      supabase
        .from('saldo_ferias')
        .select('dias_direito, dias_gozados, dias_marcados, dias_transitados')
        .eq('colaborador_id', colaborador.id)
        .eq('ano', ano)
        .maybeSingle(),
      supabase
        .from('pedidos_ferias')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .order('data_inicio', { ascending: false }),
    ]);
    if (saldoRes.data) {
      const d = saldoRes.data;
      const total = (d.dias_direito ?? 0) + (d.dias_transitados ?? 0);
      const gozados = d.dias_gozados ?? 0;
      const marcados = d.dias_marcados ?? 0;
      setSaldo({
        total,
        gozados,
        marcados,
        pendentes: marcados, // dias marcados sao os pendentes + aprovados nao gozados
        disponiveis: total - gozados - marcados,
      });
    }
    setPedidos(pedidosRes.data ?? []);
    setPageLoading(false);
  }

  // Calcular dias uteis excluindo fds e feriados
  function calcDiasUteis(inicio, fim) {
    if (!inicio || !fim) return 0;
    const start = new Date(inicio);
    const end = new Date(fim);
    if (end < start) return 0;
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dow = current.getDay();
      if (dow !== 0 && dow !== 6) {
        const ds = current.toISOString().split('T')[0];
        if (!feriadoSet.has(ds)) count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  const diasUteis = calcDiasUteis(dataInicio, dataFim);

  // Validacoes
  const hoje = new Date().toISOString().split('T')[0];

  const validacoes = useMemo(() => {
    const erros = [];
    if (dataInicio && dataInicio < hoje) erros.push('Nao pode marcar ferias para datas passadas');
    if (dataInicio && dataFim && new Date(dataFim) < new Date(dataInicio)) erros.push('Data fim deve ser posterior a data inicio');
    if (diasUteis <= 0 && dataInicio && dataFim) erros.push('O periodo nao contem dias uteis');
    if (saldo && diasUteis > saldo.disponiveis) erros.push(`Saldo insuficiente (disponiveis: ${saldo.disponiveis})`);

    // Verificar sobreposicao com pedidos existentes
    if (dataInicio && dataFim) {
      const sobrepoe = pedidos.some(p =>
        ['pendente', 'aprovado', 'sugerido'].includes(p.estado) &&
        p.data_inicio <= dataFim && p.data_fim >= dataInicio
      );
      if (sobrepoe) erros.push('Ja tem ferias marcadas que se sobrepoem com este periodo');
    }

    return erros;
  }, [dataInicio, dataFim, diasUteis, saldo, pedidos]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dataInicio || !dataFim || validacoes.length > 0) return;
    setLoading(true);

    const { error } = await supabase.from('pedidos_ferias').insert({
      user_id: colaborador.user_id,
      colaborador_id: colaborador.id,
      data_inicio: dataInicio,
      data_fim: dataFim,
      dias_uteis: diasUteis,
      notas: motivo || null,
      estado: 'pendente',
    });

    if (!error) {
      toast('Pedido de ferias enviado!', 'success');
      setShowForm(false);
      setDataInicio('');
      setDataFim('');
      setMotivo('');
      await fetchData();
    } else {
      toast('Erro ao submeter pedido', 'error');
    }
    setLoading(false);
  }

  async function handleCancelar(pedidoId) {
    const { error } = await supabase
      .from('pedidos_ferias')
      .update({ estado: 'cancelado', atualizado_em: new Date().toISOString() })
      .eq('id', pedidoId)
      .eq('colaborador_id', colaborador.id);

    if (!error) {
      toast('Pedido cancelado', 'success');
      await fetchData();
    } else {
      toast('Erro ao cancelar', 'error');
    }
  }

  const statusConfig = {
    pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700', icon: X },
    cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500', icon: X },
    sugerido: { label: 'Alteracao Sugerida', color: 'bg-purple-100 text-purple-700', icon: AlertTriangle },
  };

  // Separar pedidos
  const proximas = pedidos.filter(p => p.estado === 'aprovado' && p.data_fim >= hoje);
  const pendentes = pedidos.filter(p => p.estado === 'pendente' || p.estado === 'sugerido');
  const historico = pedidos.filter(p => p.estado !== 'pendente' && p.estado !== 'sugerido' && !(p.estado === 'aprovado' && p.data_fim >= hoje));

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ferias</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors active:scale-[0.98]"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Solicitar Ferias'}
        </button>
      </div>

      {/* Saldo Card com barra de progresso */}
      {saldo && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Saldo {ano}</h2>
            <div className="flex items-center gap-1.5">
              <Sun size={14} className="text-yellow-500" />
              <span className="text-sm font-bold text-gray-700">{saldo.disponiveis} disponiveis</span>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden mb-4">
            {/* Gozados */}
            <div
              className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${saldo.total > 0 ? (saldo.gozados / saldo.total) * 100 : 0}%` }}
            />
            {/* Marcados (pendentes/aprovados) */}
            <div
              className="absolute top-0 h-full bg-yellow-400 transition-all duration-500"
              style={{
                left: `${saldo.total > 0 ? (saldo.gozados / saldo.total) * 100 : 0}%`,
                width: `${saldo.total > 0 ? (saldo.marcados / saldo.total) * 100 : 0}%`,
              }}
            />
          </div>

          {/* Detalhe */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-gray-700">{saldo.total}</p>
              <p className="text-[10px] text-gray-400">Total</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{saldo.gozados}</p>
              <p className="text-[10px] text-gray-400">Gozados</p>
            </div>
            <div>
              <p className="text-lg font-bold text-yellow-600">{saldo.marcados}</p>
              <p className="text-[10px] text-gray-400">Marcados</p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{saldo.disponiveis}</p>
              <p className="text-[10px] text-gray-400">Disponiveis</p>
            </div>
          </div>
        </div>
      )}

      {/* Proximas ferias aprovadas */}
      {proximas.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-4">
          <h2 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
            Proximas Ferias
          </h2>
          <div className="space-y-2">
            {proximas.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    {formatDate(p.data_inicio)} — {formatDate(p.data_fim)}
                  </p>
                  <p className="text-xs text-green-600">{p.dias_uteis} dias uteis</p>
                </div>
                <CheckCircle size={18} className="text-green-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form novo pedido */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Solicitar Ferias</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Data inicio *</label>
              <input
                type="date"
                value={dataInicio}
                min={hoje}
                onChange={e => setDataInicio(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Data fim *</label>
              <input
                type="date"
                value={dataFim}
                min={dataInicio || hoje}
                onChange={e => setDataFim(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Info dias uteis */}
          {diasUteis > 0 && validacoes.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
              <CalendarDays size={14} className="text-blue-600" />
              <span className="text-xs text-blue-700 font-medium">
                {diasUteis} dia{diasUteis !== 1 ? 's' : ''} util{diasUteis !== 1 ? 'is' : ''} (excluindo fds e feriados)
              </span>
            </div>
          )}

          {/* Saldo impacto */}
          {diasUteis > 0 && saldo && validacoes.length === 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
              <span className="text-gray-500">Saldo apos este pedido:</span>
              <span className={`font-bold ${saldo.disponiveis - diasUteis >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {saldo.disponiveis - diasUteis} dias
              </span>
            </div>
          )}

          {/* Erros de validacao */}
          {validacoes.length > 0 && (
            <div className="space-y-1">
              {validacoes.map((erro, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 rounded-lg text-xs text-red-600">
                  <AlertTriangle size={12} />
                  {erro}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              placeholder="Motivo ou observacoes..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading || validacoes.length > 0 || diasUteis <= 0}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
            Enviar Pedido
          </button>
        </form>
      )}

      {/* Pedidos pendentes / com sugestao */}
      {pendentes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Pedidos Pendentes
          </h2>
          <div className="space-y-3">
            {pendentes.map(p => {
              const status = statusConfig[p.estado] ?? statusConfig.pendente;
              return (
                <div key={p.id} className="p-3 rounded-xl bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {formatDate(p.data_inicio)} — {formatDate(p.data_fim)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.dias_uteis} dias uteis</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  {p.notas && <p className="text-xs text-gray-400">{p.notas}</p>}

                  {/* Sugestao do gestor */}
                  {p.estado === 'sugerido' && p.sugestao_inicio && (
                    <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-xs font-medium text-purple-700 mb-1">Datas sugeridas pelo gestor:</p>
                      <p className="text-sm font-semibold text-purple-800">
                        {formatDate(p.sugestao_inicio)} — {formatDate(p.sugestao_fim)}
                      </p>
                      {p.resposta_gestor && (
                        <p className="text-xs text-purple-600 mt-1">{p.resposta_gestor}</p>
                      )}
                    </div>
                  )}

                  {/* Botao cancelar */}
                  {p.estado === 'pendente' && (
                    <button
                      onClick={() => handleCancelar(p.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Cancelar pedido
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Historico */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Historico
        </h2>
        {historico.length === 0 && pendentes.length === 0 && proximas.length === 0 ? (
          <div className="text-center py-10">
            <Palmtree size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Sem pedidos de ferias</p>
            <p className="text-xs text-gray-300 mt-1">Solicite as suas ferias!</p>
          </div>
        ) : historico.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sem historico anterior</p>
        ) : (
          <div className="space-y-3">
            {historico.map(p => {
              const status = statusConfig[p.estado] ?? { label: p.estado, color: 'bg-gray-100 text-gray-600' };
              return (
                <div key={p.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {formatDate(p.data_inicio)} — {formatDate(p.data_fim)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.dias_uteis} dias uteis</p>
                    {p.motivo_rejeicao && (
                      <p className="text-xs text-red-500 mt-0.5">Motivo: {p.motivo_rejeicao}</p>
                    )}
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
