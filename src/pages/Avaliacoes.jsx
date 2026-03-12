import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Star, ChevronRight, CheckCircle2, Clock, Send,
  ClipboardList, BarChart3, MessageSquare, User, Users, ArrowUp, ArrowDown,
  Loader2, AlertTriangle
} from 'lucide-react';

const tipoConfig = {
  auto: { label: 'Auto-avaliacao', icon: User, cor: 'blue' },
  superior: { label: 'Avaliar subordinado', icon: ArrowDown, cor: 'purple' },
  subordinado: { label: 'Avaliar superior', icon: ArrowUp, cor: 'orange' },
  par: { label: 'Avaliar par', icon: Users, cor: 'green' },
};

const estadoConfig = {
  pendente: { label: 'Pendente', cor: 'yellow' },
  em_curso: { label: 'Em curso', cor: 'blue' },
  submetida: { label: 'Submetida', cor: 'green' },
};

export default function Avaliacoes() {
  const { colaborador } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState('pendentes'); // pendentes | resultados
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [ciclos, setCiclos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAval, setSelectedAval] = useState(null);

  useEffect(() => {
    if (!colaborador?.id) return;
    carregar();
  }, [colaborador?.id]);

  async function carregar() {
    setLoading(true);

    // Buscar ciclos activos da empresa
    const { data: ciclosData } = await supabase
      .from('ciclos_avaliacao')
      .select('*')
      .eq('empresa_id', colaborador.empresa_id)
      .neq('estado', 'agendado')
      .order('data_inicio', { ascending: false });

    setCiclos(ciclosData ?? []);

    // Buscar minhas avaliacoes (como avaliador)
    const { data: avalsData } = await supabase
      .from('avaliacoes_360')
      .select('*, ciclos_avaliacao(nome, estado, data_limite_autoavaliacao, data_limite_avaliacao)')
      .eq('avaliador_id', colaborador.id)
      .order('created_at', { ascending: false });

    // Buscar nomes dos avaliados
    const avaliadoIds = [...new Set((avalsData ?? []).map(a => a.avaliado_id))];
    let nomeMap = {};
    if (avaliadoIds.length > 0) {
      const { data: colabs } = await supabase
        .from('colaboradores')
        .select('id, nome')
        .in('id', avaliadoIds);
      nomeMap = Object.fromEntries((colabs ?? []).map(c => [c.id, c.nome]));
    }

    setAvaliacoes((avalsData ?? []).map(a => ({
      ...a,
      avaliado_nome: a.tipo === 'auto' ? 'Eu mesmo' : (nomeMap[a.avaliado_id] || 'Colaborador'),
    })));

    setLoading(false);
  }

  const pendentes = avaliacoes.filter(a => a.estado !== 'submetida');
  const submetidas = avaliacoes.filter(a => a.estado === 'submetida');
  const ciclosConcluidos = ciclos.filter(c => c.estado === 'concluido');

  if (selectedAval) {
    return (
      <FormularioAvaliacao
        avaliacao={selectedAval}
        colaboradorId={colaborador.id}
        empresaId={colaborador.empresa_id}
        onVoltar={() => { setSelectedAval(null); carregar(); }}
        toast={toast}
      />
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/menu')} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Avaliacoes</h1>
          <p className="text-xs text-gray-500">Avaliacao 360</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { key: 'pendentes', label: 'Pendentes', icon: ClipboardList, count: pendentes.length },
          { key: 'resultados', label: 'Resultados', icon: BarChart3 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : tab === 'pendentes' ? (
        <TabPendentes
          pendentes={pendentes}
          onSeleccionar={setSelectedAval}
        />
      ) : (
        <TabResultados
          ciclos={ciclosConcluidos}
          colaboradorId={colaborador.id}
          empresaId={colaborador.empresa_id}
        />
      )}
    </div>
  );
}

/* ─── Tab Pendentes ──────────────────────────────────────────────── */

function TabPendentes({ pendentes, onSeleccionar }) {
  if (pendentes.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 size={40} className="mx-auto text-green-400 mb-3" />
        <p className="text-sm font-medium text-gray-600">Tudo em dia!</p>
        <p className="text-xs text-gray-400 mt-1">Sem avaliacoes pendentes</p>
      </div>
    );
  }

  // Agrupar por ciclo
  const porCiclo = {};
  for (const a of pendentes) {
    const cicloNome = a.ciclos_avaliacao?.nome || 'Ciclo';
    if (!porCiclo[cicloNome]) porCiclo[cicloNome] = [];
    porCiclo[cicloNome].push(a);
  }

  return (
    <div className="space-y-4">
      {Object.entries(porCiclo).map(([cicloNome, avals]) => (
        <div key={cicloNome}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
            {cicloNome}
          </h3>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {avals.map(aval => {
              const cfg = tipoConfig[aval.tipo] || tipoConfig.auto;
              const Icon = cfg.icon;
              const ciclo = aval.ciclos_avaliacao;

              // Deadline
              let deadline = null;
              if (ciclo?.estado === 'autoavaliacao' && aval.tipo === 'auto') {
                deadline = ciclo.data_limite_autoavaliacao;
              } else if (ciclo?.estado === 'avaliacao' && aval.tipo !== 'auto') {
                deadline = ciclo.data_limite_avaliacao;
              }

              const diasRestantes = deadline
                ? Math.ceil((new Date(deadline) - new Date()) / 86400000)
                : null;

              return (
                <button
                  key={aval.id}
                  onClick={() => onSeleccionar(aval)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors active:bg-gray-100"
                >
                  <div className={`w-10 h-10 bg-${cfg.cor}-50 rounded-xl flex items-center justify-center`}>
                    <Icon size={18} className={`text-${cfg.cor}-600`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{aval.avaliado_nome}</p>
                    <p className="text-xs text-gray-400">{cfg.label}</p>
                    {diasRestantes !== null && diasRestantes <= 3 && (
                      <p className={`text-[11px] font-medium mt-0.5 ${
                        diasRestantes <= 0 ? 'text-red-500' : 'text-orange-500'
                      }`}>
                        {diasRestantes <= 0 ? 'Prazo expirado!' : `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Tab Resultados ─────────────────────────────────────────────── */

function TabResultados({ ciclos, colaboradorId, empresaId }) {
  const [selectedCiclo, setSelectedCiclo] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [loadingRes, setLoadingRes] = useState(false);

  async function verResultados(ciclo) {
    setSelectedCiclo(ciclo);
    setLoadingRes(true);

    // Buscar avaliacoes onde EU sou o avaliado e estao submetidas
    const { data: avalsRecebidas } = await supabase
      .from('avaliacoes_360')
      .select('id, tipo, avaliador_id, comentario_geral')
      .eq('ciclo_id', ciclo.id)
      .eq('avaliado_id', colaboradorId)
      .eq('estado', 'submetida');

    if (!avalsRecebidas || avalsRecebidas.length === 0) {
      setResultados({ vazio: true });
      setLoadingRes(false);
      return;
    }

    // Buscar criterios
    const { data: criterios } = await supabase
      .from('criterios_avaliacao')
      .select('id, nome, peso, categoria')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('categoria', { ascending: true });

    // Buscar respostas
    const avalIds = avalsRecebidas.map(a => a.id);
    const { data: respostas } = await supabase
      .from('respostas_avaliacao')
      .select('avaliacao_id, criterio_id, nota, nota_automatica, comentario')
      .in('avaliacao_id', avalIds);

    // Agregar por direccao
    const porDireccao = {};
    for (const aval of avalsRecebidas) {
      if (!porDireccao[aval.tipo]) porDireccao[aval.tipo] = { avaliacoes: [], respostas: [] };
      porDireccao[aval.tipo].avaliacoes.push(aval);
    }

    for (const resp of (respostas ?? [])) {
      const aval = avalsRecebidas.find(a => a.id === resp.avaliacao_id);
      if (aval) {
        if (!porDireccao[aval.tipo]) porDireccao[aval.tipo] = { avaliacoes: [], respostas: [] };
        porDireccao[aval.tipo].respostas.push(resp);
      }
    }

    // Calcular medias por criterio por direccao
    const mediasDir = {};
    for (const [tipo, data] of Object.entries(porDireccao)) {
      // Anonimato: par e subordinado so mostram se >= 3 avaliadores
      const isAnonimo = tipo === 'par' || tipo === 'subordinado';
      const nAvaliadores = data.avaliacoes.length;

      if (isAnonimo && nAvaliadores < 3) {
        mediasDir[tipo] = { anonimo: true, n: nAvaliadores };
        continue;
      }

      const porCriterio = {};
      for (const resp of data.respostas) {
        const nota = resp.nota ?? resp.nota_automatica;
        if (nota == null) continue;
        if (!porCriterio[resp.criterio_id]) porCriterio[resp.criterio_id] = [];
        porCriterio[resp.criterio_id].push(nota);
      }

      const medias = {};
      for (const [cId, notas] of Object.entries(porCriterio)) {
        medias[cId] = notas.reduce((a, b) => a + b, 0) / notas.length;
      }

      mediasDir[tipo] = { medias, n: nAvaliadores };
    }

    // Nota global (media ponderada simples de todas as notas recebidas)
    const todasNotas = (respostas ?? [])
      .map(r => r.nota ?? r.nota_automatica)
      .filter(n => n != null);
    const mediaGlobal = todasNotas.length > 0
      ? todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length
      : null;

    // Feedback recebido
    const { data: feedback } = await supabase
      .from('feedback_avaliacao')
      .select('comentario, objectivos, plano_accao, realizada, data_reuniao')
      .eq('ciclo_id', ciclo.id)
      .eq('colaborador_id', colaboradorId)
      .maybeSingle();

    setResultados({
      criterios: criterios ?? [],
      mediasDir,
      mediaGlobal,
      feedback,
    });
    setLoadingRes(false);
  }

  if (selectedCiclo) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedCiclo(null); setResultados(null); }}
          className="flex items-center gap-2 text-sm text-blue-600 font-medium"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        <h3 className="text-lg font-bold text-gray-900">{selectedCiclo.nome}</h3>

        {loadingRes ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : resultados?.vazio ? (
          <div className="text-center py-8">
            <AlertTriangle size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Sem resultados disponiveis</p>
          </div>
        ) : resultados ? (
          <ResultadosView resultados={resultados} />
        ) : null}
      </div>
    );
  }

  if (ciclos.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Sem ciclos concluidos</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ciclos.map(ciclo => (
        <button
          key={ciclo.id}
          onClick={() => verResultados(ciclo)}
          className="w-full flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all active:scale-[0.99]"
        >
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
            <BarChart3 size={18} className="text-green-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-gray-800">{ciclo.nome}</p>
            <p className="text-xs text-gray-400">
              {new Date(ciclo.data_inicio).toLocaleDateString('pt-PT')} — {new Date(ciclo.data_fim).toLocaleDateString('pt-PT')}
            </p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      ))}
    </div>
  );
}

/* ─── Resultados View ────────────────────────────────────────────── */

function ResultadosView({ resultados }) {
  const { criterios, mediasDir, mediaGlobal, feedback } = resultados;

  const corNota = (nota) => {
    if (nota >= 4.5) return 'text-green-600';
    if (nota >= 3.5) return 'text-blue-600';
    if (nota >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const bgNota = (nota) => {
    if (nota >= 4.5) return 'bg-green-50';
    if (nota >= 3.5) return 'bg-blue-50';
    if (nota >= 2.5) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  return (
    <div className="space-y-4">
      {/* Nota global */}
      {mediaGlobal != null && (
        <div className={`rounded-2xl p-5 text-center ${bgNota(mediaGlobal)}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nota Global</p>
          <p className={`text-4xl font-bold ${corNota(mediaGlobal)}`}>
            {mediaGlobal.toFixed(1)}
          </p>
          <p className="text-xs text-gray-400 mt-1">de 5.0</p>
        </div>
      )}

      {/* Por direccao */}
      {Object.entries(mediasDir).map(([tipo, data]) => {
        const cfg = tipoConfig[tipo] || tipoConfig.auto;
        const Icon = cfg.icon;

        return (
          <div key={tipo} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon size={16} className={`text-${cfg.cor}-600`} />
              <h4 className="text-sm font-semibold text-gray-700">
                {tipo === 'auto' ? 'Auto-avaliacao' :
                 tipo === 'superior' ? 'Avaliacao do Superior' :
                 tipo === 'subordinado' ? 'Avaliacao dos Subordinados' :
                 'Avaliacao dos Pares'}
              </h4>
              <span className="text-xs text-gray-400 ml-auto">{data.n} avaliador{data.n !== 1 ? 'es' : ''}</span>
            </div>

            {data.anonimo ? (
              <p className="text-xs text-gray-400 italic">
                Minimo 3 avaliadores necessarios para mostrar resultados (tem {data.n})
              </p>
            ) : data.medias ? (
              <div className="space-y-2">
                {criterios.map(c => {
                  const media = data.medias[c.id];
                  if (media == null) return null;
                  return (
                    <div key={c.id} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 flex-1">{c.nome}</span>
                      <div className="flex items-center gap-1">
                        <StarRating value={media} size={12} />
                        <span className={`text-xs font-semibold ml-1 ${corNota(media)}`}>
                          {media.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Feedback */}
      {feedback && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={16} className="text-purple-600" />
            <h4 className="text-sm font-semibold text-gray-700">Feedback</h4>
            {feedback.realizada && (
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium ml-auto">
                Reuniao realizada
              </span>
            )}
          </div>
          {feedback.data_reuniao && (
            <p className="text-xs text-gray-400 mb-2">
              Data: {new Date(feedback.data_reuniao).toLocaleDateString('pt-PT')}
            </p>
          )}
          {feedback.comentario && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Comentario</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{feedback.comentario}</p>
            </div>
          )}
          {feedback.objectivos && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Objectivos</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-line">{feedback.objectivos}</p>
            </div>
          )}
          {feedback.plano_accao && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Plano de Accao</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-line">{feedback.plano_accao}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Formulario Avaliacao ───────────────────────────────────────── */

function FormularioAvaliacao({ avaliacao, colaboradorId, empresaId, onVoltar, toast }) {
  const [criterios, setCriterios] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [comentarioGeral, setComentarioGeral] = useState(avaliacao.comentario_geral || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const cfg = tipoConfig[avaliacao.tipo] || tipoConfig.auto;

  useEffect(() => {
    carregarCriterios();
  }, []);

  async function carregarCriterios() {
    // Buscar criterios activos
    const { data: crits } = await supabase
      .from('criterios_avaliacao')
      .select('id, nome, descricao, peso, categoria, fonte_dados')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('categoria')
      .order('nome');

    setCriterios(crits ?? []);

    // Buscar respostas existentes
    const { data: resps } = await supabase
      .from('respostas_avaliacao')
      .select('criterio_id, nota, nota_automatica, comentario')
      .eq('avaliacao_id', avaliacao.id);

    const respsMap = {};
    for (const r of (resps ?? [])) {
      respsMap[r.criterio_id] = {
        nota: r.nota,
        nota_automatica: r.nota_automatica,
        comentario: r.comentario || '',
      };
    }
    setRespostas(respsMap);
    setLoading(false);
  }

  function setNota(criterioId, nota) {
    setRespostas(prev => ({
      ...prev,
      [criterioId]: { ...(prev[criterioId] || {}), nota },
    }));
  }

  function setComentario(criterioId, comentario) {
    setRespostas(prev => ({
      ...prev,
      [criterioId]: { ...(prev[criterioId] || {}), comentario },
    }));
  }

  async function guardar(submeter = false) {
    setSubmitting(true);

    // Upsert respostas
    const rows = Object.entries(respostas)
      .filter(([, v]) => v.nota != null)
      .map(([criterioId, v]) => ({
        avaliacao_id: avaliacao.id,
        criterio_id: criterioId,
        nota: v.nota,
        comentario: v.comentario || null,
      }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from('respostas_avaliacao')
        .upsert(rows, { onConflict: 'avaliacao_id,criterio_id' });

      if (error) {
        toast('Erro ao guardar respostas', 'error');
        setSubmitting(false);
        return;
      }
    }

    // Actualizar avaliacao
    const updateData = {
      comentario_geral: comentarioGeral || null,
      estado: submeter ? 'submetida' : 'em_curso',
      updated_at: new Date().toISOString(),
    };

    if (submeter) {
      updateData.data_submissao = new Date().toISOString();
    }

    const { error: avalErr } = await supabase
      .from('avaliacoes_360')
      .update(updateData)
      .eq('id', avaliacao.id);

    if (avalErr) {
      toast('Erro ao actualizar avaliacao', 'error');
      setSubmitting(false);
      return;
    }

    toast(submeter ? 'Avaliacao submetida!' : 'Rascunho guardado', 'success');
    setSubmitting(false);
    if (submeter) onVoltar();
  }

  async function submeter() {
    // Validar — todas os criterios sem fonte_dados precisam de nota
    const criteriosManuais = criterios.filter(c => !c.fonte_dados);
    const faltam = criteriosManuais.filter(c => !respostas[c.id]?.nota);

    if (faltam.length > 0) {
      toast(`Faltam ${faltam.length} criterio(s) por avaliar`, 'error');
      return;
    }

    await guardar(true);
  }

  if (loading) {
    return (
      <div className="p-4 pb-24 flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // Agrupar criterios por categoria
  const porCategoria = {};
  for (const c of criterios) {
    const cat = c.categoria || 'Geral';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(c);
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onVoltar} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{avaliacao.avaliado_nome}</h1>
          <p className="text-xs text-gray-500">{cfg.label} — {avaliacao.ciclos_avaliacao?.nome}</p>
        </div>
      </div>

      {/* Criterios por categoria */}
      {Object.entries(porCategoria).map(([cat, crits]) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{cat}</h3>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {crits.map(criterio => {
              const resp = respostas[criterio.id] || {};
              const isAuto = !!criterio.fonte_dados;

              return (
                <div key={criterio.id} className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{criterio.nome}</p>
                      {criterio.descricao && (
                        <p className="text-xs text-gray-400 mt-0.5">{criterio.descricao}</p>
                      )}
                    </div>
                    {criterio.peso && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-2">
                        {criterio.peso}%
                      </span>
                    )}
                  </div>

                  {isAuto ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">Nota automatica:</span>
                      {resp.nota_automatica != null ? (
                        <span className="text-sm font-semibold text-blue-600">{resp.nota_automatica.toFixed(1)}</span>
                      ) : (
                        <span className="text-xs text-gray-300">Pendente</span>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="mt-2">
                        <StarInput value={resp.nota || 0} onChange={(v) => setNota(criterio.id, v)} />
                      </div>
                      <input
                        type="text"
                        placeholder="Comentario (opcional)"
                        value={resp.comentario || ''}
                        onChange={(e) => setComentario(criterio.id, e.target.value)}
                        className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Comentario geral */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Comentario Geral
        </h3>
        <textarea
          value={comentarioGeral}
          onChange={e => setComentarioGeral(e.target.value)}
          placeholder="Observacoes gerais sobre o desempenho..."
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
        />
      </div>

      {/* Botoes */}
      <div className="flex gap-3">
        <button
          onClick={() => guardar(false)}
          disabled={submitting}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Guardar Rascunho'}
        </button>
        <button
          onClick={submeter}
          disabled={submitting}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Send size={16} /> Submeter
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Star Components ────────────────────────────────────────────── */

function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            size={24}
            className={`transition-colors ${
              i <= (hover || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-sm font-semibold text-gray-600 ml-2 self-center">{value}.0</span>
      )}
    </div>
  );
}

function StarRating({ value, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={
            i <= Math.round(value)
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }
        />
      ))}
    </div>
  );
}
