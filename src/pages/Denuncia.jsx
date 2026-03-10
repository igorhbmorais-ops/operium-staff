import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Send, Search, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

const TIPOS = [
  { value: 'assedio_moral', label: 'Assédio moral' },
  { value: 'assedio_sexual', label: 'Assédio sexual' },
  { value: 'discriminacao', label: 'Discriminação' },
  { value: 'condicoes_inseguras', label: 'Condições inseguras' },
  { value: 'violacao_direitos', label: 'Violação de direitos' },
  { value: 'fraude', label: 'Fraude' },
  { value: 'outro', label: 'Outro' },
];

const statusColors = {
  pendente: 'bg-yellow-100 text-yellow-800',
  em_analise: 'bg-blue-100 text-blue-800',
  resolvida: 'bg-green-100 text-green-800',
  arquivada: 'bg-gray-100 text-gray-600',
};

const statusLabels = {
  pendente: 'Pendente',
  em_analise: 'Em análise',
  resolvida: 'Resolvida',
  arquivada: 'Arquivada',
};

function gerarCodigo() {
  const ano = new Date().getFullYear();
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `DEN-${ano}-${rand}`;
}

export default function Denuncia() {
  const { colaborador } = useAuth();

  // Form state
  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataIncidente, setDataIncidente] = useState('');
  const [envolvidos, setEnvolvidos] = useState('');
  const [anonima, setAnonima] = useState(true);
  const [loading, setLoading] = useState(false);
  const [codigoGerado, setCodigoGerado] = useState(null);
  const [erro, setErro] = useState('');

  // Tracking state
  const [codigoBusca, setCodigoBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erroBusca, setErroBusca] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');

    if (!tipo) {
      setErro('Selecione o tipo de denúncia.');
      return;
    }
    if (descricao.trim().length < 50) {
      setErro('A descrição deve ter pelo menos 50 caracteres.');
      return;
    }

    setLoading(true);
    const codigo = gerarCodigo();

    const { error } = await supabase.from('denuncias').insert({
      user_id: colaborador.user_id,
      empresa_id: colaborador.empresa_id,
      codigo,
      tipo,
      descricao: descricao.trim(),
      data_incidente: dataIncidente || null,
      envolvidos: envolvidos.trim() || null,
      anonima,
      colaborador_id: anonima ? null : colaborador.id,
      estado: 'pendente',
    });

    if (error) {
      console.error('Erro ao submeter denúncia:', error);
      setErro('Erro ao submeter. Tente novamente.');
    } else {
      setCodigoGerado(codigo);
      setTipo('');
      setDescricao('');
      setDataIncidente('');
      setEnvolvidos('');
      setAnonima(true);
    }
    setLoading(false);
  }

  async function handleBuscar(e) {
    e.preventDefault();
    setErroBusca('');
    setResultado(null);

    if (!codigoBusca.trim()) return;

    setBuscando(true);
    const { data, error } = await supabase
      .from('denuncias')
      .select('codigo, tipo, estado, resolucao, created_at')
      .eq('codigo', codigoBusca.trim().toUpperCase())
      .maybeSingle();

    if (error) {
      setErroBusca('Erro ao pesquisar. Tente novamente.');
    } else if (!data) {
      setErroBusca('Denúncia não encontrada. Verifique o código.');
    } else {
      setResultado(data);
    }
    setBuscando(false);
  }

  // Success screen after submitting
  if (codigoGerado) {
    return (
      <div className="p-4 pb-24 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Canal de Denúncia</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center space-y-4">
          <CheckCircle size={48} className="mx-auto text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900">Denúncia Submetida</h2>
          <p className="text-sm text-gray-500">
            A sua denúncia foi registada com sucesso. Guarde o código abaixo para acompanhar o estado.
          </p>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Código de acompanhamento</p>
            <p className="text-2xl font-bold text-blue-600 tracking-wider">{codigoGerado}</p>
          </div>
          <button
            onClick={() => setCodigoGerado(null)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Submeter nova denúncia
          </button>
        </div>

        {/* Tracking section still visible */}
        <SeccaoAcompanhar
          codigoBusca={codigoBusca}
          setCodigoBusca={setCodigoBusca}
          buscando={buscando}
          handleBuscar={handleBuscar}
          resultado={resultado}
          erroBusca={erroBusca}
        />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert size={24} className="text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">Canal de Denúncia</h1>
      </div>

      <p className="text-sm text-gray-500">
        Utilize este canal para reportar situações irregulares. A sua identidade será protegida se optar por denúncia anónima.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Nova Denúncia</h2>

        {/* Tipo */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo de denúncia *</label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">Selecione...</option>
            {TIPOS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Descrição * <span className="text-gray-400">(mín. 50 caracteres)</span>
          </label>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            rows={5}
            required
            minLength={50}
            placeholder="Descreva a situação com o máximo de detalhe possível..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
          <p className={cn('text-xs mt-1', descricao.length < 50 ? 'text-gray-400' : 'text-green-600')}>
            {descricao.length}/50 caracteres
          </p>
        </div>

        {/* Data do incidente */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data do incidente (opcional)</label>
          <input
            type="date"
            value={dataIncidente}
            onChange={e => setDataIncidente(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        {/* Envolvidos */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pessoas envolvidas (opcional)</label>
          <input
            type="text"
            value={envolvidos}
            onChange={e => setEnvolvidos(e.target.value)}
            placeholder="Nomes, cargos ou departamentos..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        {/* Anónima */}
        <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
          <input
            type="checkbox"
            id="anonima"
            checked={anonima}
            onChange={e => setAnonima(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor="anonima" className="text-sm text-gray-700 cursor-pointer">
            <span className="font-medium flex items-center gap-1">
              {anonima ? <EyeOff size={14} /> : <Eye size={14} />}
              Denúncia anónima
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              {anonima
                ? 'A sua identidade não será associada a esta denúncia.'
                : 'A sua identidade será associada a esta denúncia.'}
            </span>
          </label>
        </div>

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{erro}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-red-600 text-white text-sm py-2.5 rounded-lg hover:bg-red-700 disabled:bg-red-400"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Submeter Denúncia
        </button>
      </form>

      {/* Tracking section */}
      <SeccaoAcompanhar
        codigoBusca={codigoBusca}
        setCodigoBusca={setCodigoBusca}
        buscando={buscando}
        handleBuscar={handleBuscar}
        resultado={resultado}
        erroBusca={erroBusca}
      />
    </div>
  );
}

function SeccaoAcompanhar({ codigoBusca, setCodigoBusca, buscando, handleBuscar, resultado, erroBusca }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        Acompanhar Denúncia
      </h2>
      <form onSubmit={handleBuscar} className="flex gap-2">
        <input
          type="text"
          value={codigoBusca}
          onChange={e => setCodigoBusca(e.target.value)}
          placeholder="Ex: DEN-2026-1234"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <button
          type="submit"
          disabled={buscando}
          className="flex items-center gap-1 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
        >
          {buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Pesquisar
        </button>
      </form>

      {erroBusca && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{erroBusca}</p>
      )}

      {resultado && (
        <div className="border border-gray-100 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{resultado.codigo}</p>
            <span className={cn(
              'text-xs font-medium px-2 py-1 rounded-full',
              statusColors[resultado.estado] ?? 'bg-gray-100 text-gray-600'
            )}>
              {statusLabels[resultado.estado] ?? resultado.estado}
            </span>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <span className="font-medium text-gray-600">Tipo:</span>{' '}
              {TIPOS.find(t => t.value === resultado.tipo)?.label ?? resultado.tipo}
            </p>
            <p>
              <span className="font-medium text-gray-600">Submetida:</span>{' '}
              {formatDate(resultado.created_at)}
            </p>
            {resultado.resolucao && (
              <div className="mt-2 bg-green-50 rounded-lg p-3">
                <p className="font-medium text-green-800 text-xs mb-1">Resolução</p>
                <p className="text-green-700 text-sm">{resultado.resolucao}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
