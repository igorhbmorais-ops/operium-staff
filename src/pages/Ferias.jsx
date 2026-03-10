import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CalendarDays, Plus, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function Ferias() {
  const { colaborador } = useAuth();
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
        dias_disponiveis: total - (d.dias_gozados ?? 0) - (d.dias_marcados ?? 0),
        dias_gozados: d.dias_gozados ?? 0,
        dias_totais: total,
      });
    }
    setPedidos(pedidosRes.data ?? []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dataInicio || !dataFim) return;
    setLoading(true);

    const { error } = await supabase.from('pedidos_ferias').insert({
      user_id: colaborador.user_id,
      colaborador_id: colaborador.id,
      data_inicio: dataInicio,
      data_fim: dataFim,
      notas: notas || null,
      estado: 'pendente',
    });

    if (!error) {
      setShowForm(false);
      setDataInicio('');
      setDataFim('');
      setNotas('');
      await fetchData();
    }
    setLoading(false);
  }

  const statusColors = {
    pendente: 'bg-yellow-100 text-yellow-800',
    aprovado: 'bg-green-100 text-green-800',
    recusado: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Férias</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-blue-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> Pedir
        </button>
      </div>

      {/* Saldo */}
      {saldo && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Saldo {new Date().getFullYear()}
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{saldo.dias_disponiveis}</p>
              <p className="text-xs text-gray-500">Disponíveis</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700">{saldo.dias_gozados}</p>
              <p className="text-xs text-gray-500">Gozados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{saldo.dias_totais}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>
      )}

      {/* Form novo pedido */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Novo Pedido de Férias</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
            Submeter Pedido
          </button>
        </form>
      )}

      {/* Lista de pedidos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Pedidos
        </h2>
        {pedidos.length === 0 ? (
          <p className="text-gray-400 text-sm">Sem pedidos de férias</p>
        ) : (
          <div className="space-y-3">
            {pedidos.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {formatDate(p.data_inicio)} — {formatDate(p.data_fim)}
                  </p>
                  {p.notas && <p className="text-xs text-gray-400">{p.notas}</p>}
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[p.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.estado}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
