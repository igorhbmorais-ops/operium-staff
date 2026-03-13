import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Receipt, Plus, X, Loader2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/utils';

const CATEGORIAS = [
  { value: 'transporte', label: 'Transporte' },
  { value: 'material', label: 'Material' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'outro', label: 'Outro' },
];

const ESTADO_BADGE = {
  pendente:  'bg-yellow-100 text-yellow-700',
  aprovada:  'bg-green-100 text-green-700',
  rejeitada: 'bg-red-100 text-red-700',
  paga:      'bg-blue-100 text-blue-700',
};

const ESTADO_LABEL = {
  pendente:  'Pendente',
  aprovada:  'Aprovada',
  rejeitada: 'Rejeitada',
  paga:      'Paga',
};

export default function Despesas() {
  const { colaborador, refreshColaborador } = useAuth();
  const navigate = useNavigate();
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('transporte');
  const [categoriaOutro, setCategoriaOutro] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  // Verificar permissão
  const temPermissao = colaborador?.permissoes?.despesas === true;

  // Re-fetch permissões ao abrir a página (detecta alterações do gestor)
  useEffect(() => {
    if (colaborador?.id) refreshColaborador();
  }, []);

  useEffect(() => {
    if (!colaborador?.id) return;
    if (!temPermissao) { setLoading(false); return; }
    fetchDespesas();
  }, [colaborador?.id, temPermissao]);

  async function fetchDespesas() {
    const { data } = await supabase
      .from('despesas_colaborador')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .order('created_at', { ascending: false });

    setDespesas(data ?? []);
    setLoading(false);
  }

  function resetForm() {
    setDescricao('');
    setValor('');
    setCategoria('transporte');
    setCategoriaOutro('');
    setData(new Date().toISOString().slice(0, 10));
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!descricao.trim() || !valor || !data) return;

    setSubmitting(true);
    const { error } = await supabase.from('despesas_colaborador').insert({
      user_id: colaborador.user_id,
      empresa_id: colaborador.empresa_id,
      colaborador_id: colaborador.id,
      descricao: descricao.trim(),
      valor: parseFloat(valor),
      categoria: categoria === 'outro' && categoriaOutro.trim() ? categoriaOutro.trim() : categoria,
      data,
    });

    if (!error) {
      resetForm();
      await fetchDespesas();
    }
    setSubmitting(false);
  }

  if (!temPermissao) {
    return (
      <div className="p-4 pb-24 flex flex-col items-center justify-center text-center" style={{ minHeight: 'calc(100vh - 8rem)' }}>
        <Lock size={48} className="text-gray-300 mb-4" />
        <p className="text-lg font-semibold text-gray-700">Funcionalidade indisponível</p>
        <p className="text-sm text-gray-400 mt-2 max-w-xs">
          A submissão de despesas não está activa para a sua conta. Contacte o seu gestor se necessitar de acesso.
        </p>
        <button
          onClick={() => navigate('/menu')}
          className="mt-6 text-sm text-blue-600 font-medium hover:underline"
        >
          Voltar ao menu
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Despesas</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nova Despesa
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Nova Despesa</h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Táxi para reunião com cliente"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (€)</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={categoria}
              onChange={(e) => { setCategoria(e.target.value); if (e.target.value !== 'outro') setCategoriaOutro(''); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {categoria === 'outro' && (
              <input
                type="text"
                value={categoriaOutro}
                onChange={(e) => setCategoriaOutro(e.target.value)}
                placeholder="Especifique a categoria..."
                required
                className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Submeter Despesa
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : despesas.length === 0 ? (
        <div className="text-center py-12">
          <Receipt size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Sem despesas registadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {despesas.map((d) => (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.descricao}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(d.valor)}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span className="capitalize">{CATEGORIAS.find(c => c.value === d.categoria)?.label ?? d.categoria}</span>
                    <span>{formatDate(d.data)}</span>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${ESTADO_BADGE[d.estado] ?? ESTADO_BADGE.pendente}`}
                >
                  {ESTADO_LABEL[d.estado] ?? 'Pendente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
