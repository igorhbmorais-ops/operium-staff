import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { CalendarDays, Plus, Loader2, Palmtree, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function Ferias() {
  const { colaborador } = useAuth();
  const toast = useToast();
  const [saldo, setSaldo] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchData();
  }, [colaborador?.id]);

  async function fetchData() {
    const [saldoRes, pedidosRes] = await Promise.all([
      supabase
        .from('saldo_ferias')
        .select('dias_direito, dias_gozados, dias_marcados, dias_transitados')
        .eq('colaborador_id', colaborador.id)
        .eq('ano', new Date().getFullYear())
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
      setSaldo({
        total,
        gozados: d.dias_gozados ?? 0,
        marcados: d.dias_marcados ?? 0,
        disponiveis: total - (d.dias_gozados ?? 0) - (d.dias_marcados ?? 0),
      });
    }
    setPedidos(pedidosRes.data ?? []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dataInicio || !dataFim) return;
    if (new Date(dataFim) < new Date(dataInicio)) {
      toast('Data fim deve ser posterior à data início', 'error');
      return;
    }
    setLoading(true);

    const { error } = await supabase.from('pedidos_ferias').insert({
      user_id: colaborador.user_id,
      colaborador_id: colaborador.id,
      data_inicio: dataInicio,
      data_fim: dataFim,
      dias_uteis: diasUteis,
      notas: notas || null,
      estado: 'pendente',
    });

    if (!error) {
      toast('Pedido de férias enviado!', 'success');
      setShowForm(false);
      setDataInicio('');
      setDataFim('');
      setNotas('');
      await fetchData();
    } else {
      toast('Erro ao submeter pedido', 'error');
    }
    setLoading(false);
  }

  const statusConfig = {
    pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
    aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
    recusado: { label: 'Recusado', color: 'bg-red-100 text-red-700' },
    cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600' },
  };

  let diasUteis = 0;
  if (dataInicio && dataFim && new Date(dataFim) >= new Date(dataInicio)) {
    const start = new Date(dataInicio);
    const end = new Date(dataFim);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) diasUteis++;
    }
  }

  return (
    <div className="p-4 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Férias</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors active:scale-[0.98]"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Novo Pedido'}
        </button>
      </div>

      {/* Saldo — grid 4 colunas */}
      {saldo && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: saldo.total, color: 'text-gray-700' },
            { label: 'Gozados', value: saldo.gozados, color: 'text-blue-600' },
            { label: 'Marcados', value: saldo.marcados, color: 'text-yellow-600' },
            { label: 'Disponíveis', value: saldo.disponiveis, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Form novo pedido */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Novo Pedido de Férias</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Data início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          {diasUteis > 0 && (
            <p className="text-xs text-blue-600 font-medium">
              {diasUteis} dia{diasUteis !== 1 ? 's' : ''} útil{diasUteis !== 1 ? 'is' : ''}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Motivo ou observações..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none bg-gray-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
            Enviar Pedido
          </button>
        </form>
      )}

      {/* Lista de pedidos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Pedidos
        </h2>
        {pedidos.length === 0 ? (
          <div className="text-center py-10">
            <Palmtree size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">Sem pedidos de férias</p>
            <p className="text-xs text-gray-300 mt-1">Marque as suas férias!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pedidos.map(p => {
              const status = statusConfig[p.estado] ?? { label: p.estado, color: 'bg-gray-100 text-gray-600' };
              return (
                <div key={p.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {formatDate(p.data_inicio)} — {formatDate(p.data_fim)}
                    </p>
                    {p.notas && <p className="text-xs text-gray-400 mt-0.5">{p.notas}</p>}
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
