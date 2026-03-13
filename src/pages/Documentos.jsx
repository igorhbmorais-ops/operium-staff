import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  FileText, GraduationCap, Stethoscope, ScrollText, ClipboardList, Plus, Loader2, Send,
  Star, ChevronLeft, CheckCircle, XCircle, Download, BookOpen, HelpCircle, StickyNote,
  FolderOpen, Link as LinkIcon, Pin,
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { ListSkeleton } from '@/components/Skeleton';

const tabs = [
  { id: 'recibos', label: 'Recibos', icon: FileText },
  { id: 'contrato', label: 'Contrato', icon: ScrollText },
  { id: 'declaracoes', label: 'Declar.', icon: ClipboardList },
  { id: 'formacao', label: 'Formacao', icon: GraduationCap },
  { id: 'exames', label: 'Exames', icon: Stethoscope },
];

const TIPOS_DECLARACAO = [
  { value: 'vinculo_laboral', label: 'Declaracao de vinculo laboral' },
  { value: 'rendimentos', label: 'Declaracao de rendimentos' },
  { value: 'certificado_trabalho', label: 'Certificado de trabalho' },
];

export default function Documentos() {
  const { colaborador } = useAuth();
  const [activeTab, setActiveTab] = useState('recibos');
  const [recibos, setRecibos] = useState([]);
  const [formacoes, setFormacoes] = useState([]);
  const [elearningModulos, setElearningModulos] = useState([]);
  const [exames, setExames] = useState([]);
  const [declaracoes, setDeclaracoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeclForm, setShowDeclForm] = useState(false);
  const [declTipo, setDeclTipo] = useState('vinculo_laboral');
  const [declMotivo, setDeclMotivo] = useState('');
  const [declLoading, setDeclLoading] = useState(false);
  // Formacao review state
  const [reviewModulo, setReviewModulo] = useState(null);
  const [notasMap, setNotasMap] = useState({});

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchAll();
  }, [colaborador?.id]);

  async function fetchAll() {
    setLoading(true);
    const [recRes, formRes, examRes, declRes, modRes, notasRes] = await Promise.all([
      supabase.from('recibos_salario').select('*').eq('colaborador_id', colaborador.id).order('ano', { ascending: false }).order('mes', { ascending: false }),
      supabase.from('formacao_sessoes').select('*').eq('colaborador_id', colaborador.id).order('data_inicio', { ascending: false }),
      supabase.from('medicina_trabalho').select('*').eq('colaborador_id', colaborador.id).order('data_exame', { ascending: false }),
      supabase.from('declaracoes_pedidos').select('*').eq('colaborador_id', colaborador.id).order('created_at', { ascending: false }),
      // E-learning: buscar modulos atribuidos ao colaborador com progresso
      supabase.from('formacao_atribuicoes').select('modulo_id, formacao_modulos(*)').eq('colaborador_id', colaborador.id),
      // Notas pessoais
      supabase.from('formacao_notas').select('*').eq('colaborador_id', colaborador.id),
    ]);
    setRecibos(recRes.data ?? []);
    setFormacoes(formRes.data ?? []);
    setExames(examRes.data ?? []);
    setDeclaracoes(declRes.data ?? []);

    // Processar modulos e-learning
    const modulos = (modRes.data ?? []).map(a => a.formacao_modulos).filter(Boolean);
    // Buscar progresso para cada modulo
    if (modulos.length > 0) {
      const { data: progressos } = await supabase
        .from('formacao_progresso')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .in('modulo_id', modulos.map(m => m.id));

      const progressoMap = {};
      (progressos ?? []).forEach(p => { progressoMap[p.modulo_id] = p; });
      modulos.forEach(m => { m._progresso = progressoMap[m.id] || null; });
    }
    setElearningModulos(modulos);

    // Map de notas
    const nm = {};
    (notasRes.data ?? []).forEach(n => { nm[n.formacao_id] = n; });
    setNotasMap(nm);

    setLoading(false);
  }

  async function solicitarDeclaracao(e) {
    e.preventDefault();
    setDeclLoading(true);
    const { error } = await supabase.from('declaracoes_pedidos').insert({
      user_id: colaborador.user_id,
      empresa_id: colaborador.empresa_id ?? null,
      colaborador_id: colaborador.id,
      tipo: declTipo,
      motivo: declMotivo || null,
    });
    if (!error) {
      setShowDeclForm(false);
      setDeclMotivo('');
      await fetchAll();
    }
    setDeclLoading(false);
  }

  async function handleToggleFixar(formacaoId) {
    const empresaId = colaborador.empresa_id;
    const existente = notasMap[formacaoId];
    const novoValor = !(existente?.fixada);

    await supabase.from('formacao_notas').upsert({
      empresa_id: empresaId,
      formacao_id: formacaoId,
      colaborador_id: colaborador.id,
      fixada: novoValor,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'formacao_id,colaborador_id' });

    setNotasMap(prev => ({
      ...prev,
      [formacaoId]: { ...prev[formacaoId], fixada: novoValor, formacao_id: formacaoId, colaborador_id: colaborador.id },
    }));
  }

  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const anoActual = new Date().getFullYear();
  const horasAno = formacoes
    .filter(f => f.data_inicio && new Date(f.data_inicio).getFullYear() === anoActual)
    .reduce((sum, f) => sum + (Number(f.horas) || 0), 0);

  const estadoDecl = {
    solicitado: { label: 'Solicitado', color: 'bg-yellow-100 text-yellow-700' },
    em_preparacao: { label: 'Em preparacao', color: 'bg-blue-100 text-blue-700' },
    disponivel: { label: 'Disponivel', color: 'bg-green-100 text-green-700' },
    rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700' },
  };

  // Separar formacoes fixadas
  const allFormacoes = [
    ...formacoes.map(f => ({ ...f, _type: 'sessao' })),
    ...elearningModulos.map(m => ({ ...m, _type: 'elearning' })),
  ];
  const fixadas = allFormacoes.filter(f => notasMap[f.id]?.fixada);
  const naoFixadas = allFormacoes.filter(f => !notasMap[f.id]?.fixada);

  // Review mode
  if (reviewModulo) {
    return (
      <FormacaoReview
        modulo={reviewModulo}
        colaboradorId={colaborador.id}
        empresaId={colaborador.empresa_id}
        notas={notasMap[reviewModulo.id]}
        onBack={() => setReviewModulo(null)}
        onNotasChange={(n) => setNotasMap(prev => ({ ...prev, [reviewModulo.id]: n }))}
      />
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>

      {/* Tab Bar */}
      <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap ${
              activeTab === id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3"><ListSkeleton rows={3} /><ListSkeleton rows={2} /></div>
      ) : (
        <>
          {/* Recibos */}
          {activeTab === 'recibos' && (
            <div className="space-y-3">
              {recibos.length === 0 ? (
                <EmptyState icon={FileText} text="Sem recibos disponiveis" />
              ) : recibos.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">{meses[(r.mes ?? 1) - 1]} {r.ano}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {r.estado ?? 'processado'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Bruto</p>
                      <p className="text-sm font-medium text-gray-700">{formatCurrency(r.remuneracao_bruta)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Descontos</p>
                      <p className="text-sm font-medium text-red-600">-{formatCurrency(r.total_descontos)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Liquido</p>
                      <p className="text-sm font-bold text-green-600">{formatCurrency(r.liquido)}</p>
                    </div>
                  </div>
                  {r.ss_colaborador && (
                    <div className="mt-2 pt-2 border-t border-gray-50 flex gap-4 text-xs text-gray-400">
                      <span>SS: {formatCurrency(r.ss_colaborador)}</span>
                      <span>IRS: {formatCurrency(r.irs_retido)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Contrato */}
          {activeTab === 'contrato' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800">Dados do Contrato</h2>
              <div className="space-y-3 text-sm">
                <InfoRow label="Nome" value={colaborador?.nome} />
                <InfoRow label="Categoria" value={colaborador?.categoria} />
                <InfoRow label="Email" value={colaborador?.email} />
              </div>
              <p className="text-xs text-gray-400 pt-2">
                Para mais detalhes do contrato, contacte o seu empregador.
              </p>
            </div>
          )}

          {/* Declaracoes */}
          {activeTab === 'declaracoes' && (
            <div className="space-y-3">
              <button
                onClick={() => setShowDeclForm(!showDeclForm)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} /> Solicitar Declaracao
              </button>

              {showDeclForm && (
                <form onSubmit={solicitarDeclaracao} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de declaracao</label>
                    <select
                      value={declTipo}
                      onChange={e => setDeclTipo(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50"
                    >
                      {TIPOS_DECLARACAO.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                    <textarea
                      value={declMotivo}
                      onChange={e => setDeclMotivo(e.target.value)}
                      placeholder="Ex: Para apresentar ao banco"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none bg-gray-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={declLoading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    {declLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Enviar Pedido
                  </button>
                </form>
              )}

              {declaracoes.length === 0 && !showDeclForm ? (
                <EmptyState icon={ClipboardList} text="Sem declaracoes solicitadas" />
              ) : declaracoes.map(d => {
                const est = estadoDecl[d.estado] ?? { label: d.estado, color: 'bg-gray-100 text-gray-600' };
                const tipoLabel = TIPOS_DECLARACAO.find(t => t.value === d.tipo)?.label ?? d.tipo;
                return (
                  <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-800">{tipoLabel}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${est.color}`}>{est.label}</span>
                    </div>
                    {d.motivo && <p className="text-xs text-gray-400">{d.motivo}</p>}
                    <p className="text-xs text-gray-300 mt-1">{formatDate(d.created_at)}</p>
                    {d.notas_gestor && <p className="text-xs text-gray-500 mt-1 italic">Nota: {d.notas_gestor}</p>}
                    {d.documento_url && d.estado === 'disponivel' && (
                      <a
                        href={d.documento_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-2 hover:underline"
                      >
                        Descarregar documento
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Formacao */}
          {activeTab === 'formacao' && (
            <div className="space-y-3">
              {/* Progresso anual */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Progresso {anoActual}</p>
                  <p className="text-sm font-bold text-blue-600">{horasAno}h / 40h</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(100, (horasAno / 40) * 100)}%` }} />
                </div>
              </div>

              {/* Fixadas */}
              {fixadas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <Pin size={12} /> Fixadas
                  </p>
                  {fixadas.map(f => (
                    <FormacaoCard
                      key={f.id}
                      formacao={f}
                      isFixada
                      onToggleFixar={() => handleToggleFixar(f.id)}
                      onReview={f._type === 'elearning' && f._progresso?.estado === 'aprovado' ? () => setReviewModulo(f) : null}
                    />
                  ))}
                </div>
              )}

              {/* Restantes */}
              {allFormacoes.length === 0 ? (
                <EmptyState icon={GraduationCap} text="Sem formacoes registadas" />
              ) : (
                <div className="space-y-2">
                  {fixadas.length > 0 && naoFixadas.length > 0 && (
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Todas</p>
                  )}
                  {naoFixadas.map(f => (
                    <FormacaoCard
                      key={f.id}
                      formacao={f}
                      isFixada={false}
                      onToggleFixar={() => handleToggleFixar(f.id)}
                      onReview={f._type === 'elearning' && f._progresso?.estado === 'aprovado' ? () => setReviewModulo(f) : null}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Exames Medicos */}
          {activeTab === 'exames' && (
            <div className="space-y-3">
              {exames.length === 0 ? (
                <EmptyState icon={Stethoscope} text="Sem exames registados" />
              ) : exames.map(e => {
                const resultColor = {
                  apto: 'bg-green-100 text-green-700',
                  apto_condicional: 'bg-yellow-100 text-yellow-700',
                  inapto_temporario: 'bg-orange-100 text-orange-700',
                  inapto_definitivo: 'bg-red-100 text-red-700',
                };
                return (
                  <div key={e.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-800 capitalize">{e.tipo_exame}</p>
                      {e.resultado && (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${resultColor[e.resultado] ?? 'bg-gray-100 text-gray-600'}`}>
                          {e.resultado.replace(/_/g, ' ')}
                        </span>
                      )}
                      {e.proximo_exame && (
                        <p className="text-xs text-gray-400 mt-1">Proximo: {formatDate(e.proximo_exame)}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(e.data_exame)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Formacao Card (sessao presencial ou e-learning)
// ────────────────────────────────────────────────────────────────────
function FormacaoCard({ formacao, isFixada, onToggleFixar, onReview }) {
  const f = formacao;
  const isElearning = f._type === 'elearning';
  const progresso = f._progresso;

  const estadoCores = {
    aprovado: 'bg-green-100 text-green-700',
    reprovado: 'bg-red-100 text-red-700',
    em_curso: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-800 truncate">{f.titulo}</p>
            {isElearning && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium whitespace-nowrap">E-Learning</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {f.carga_horaria ? `${f.carga_horaria}h` : f.horas ? `${f.horas}h` : ''}
            {f.categoria ? ` · ${f.categoria}` : ''}
          </p>
          {progresso && (
            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${estadoCores[progresso.estado] ?? 'bg-gray-100 text-gray-600'}`}>
              {progresso.estado?.replace('_', ' ') ?? 'pendente'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onToggleFixar}
            className={`p-1.5 rounded-lg transition-colors ${isFixada ? 'text-yellow-500 bg-yellow-50' : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'}`}
            title={isFixada ? 'Desafixar' : 'Fixar'}
          >
            <Star size={16} fill={isFixada ? 'currentColor' : 'none'} />
          </button>
          {onReview && (
            <button
              onClick={onReview}
              className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Rever
            </button>
          )}
        </div>
      </div>
      {!isElearning && f.data_inicio && (
        <p className="text-xs text-gray-400 mt-1">{formatDate(f.data_inicio)}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Formacao Review (full-page)
// ────────────────────────────────────────────────────────────────────
function FormacaoReview({ modulo, colaboradorId, empresaId, notas: initialNotas, onBack, onNotasChange }) {
  const [activeSection, setActiveSection] = useState('conteudo');
  const [seccoes, setSeccoes] = useState([]);
  const [quizReview, setQuizReview] = useState(null);
  const [materiais, setMateriais] = useState([]);
  const [notasTexto, setNotasTexto] = useState(initialNotas?.notas || '');
  const [loading, setLoading] = useState(true);
  const [savingNotas, setSavingNotas] = useState(false);
  const notasRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [modulo.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [secRes, tentRes, matRes] = await Promise.all([
        supabase.from('formacao_seccoes').select('*').eq('modulo_id', modulo.id).order('ordem'),
        // Buscar ultima tentativa + perguntas
        Promise.all([
          supabase.from('formacao_tentativas').select('*').eq('modulo_id', modulo.id).eq('colaborador_id', colaboradorId).order('numero_tentativa', { ascending: false }).limit(1),
          supabase.from('formacao_perguntas').select('*').eq('modulo_id', modulo.id).order('ordem'),
        ]),
        supabase.from('formacao_materiais').select('*').eq('formacao_id', modulo.id).order('created_at', { ascending: false }),
      ]);

      setSeccoes(secRes.data ?? []);
      setMateriais(matRes.data ?? []);

      // Construir revisao de quiz
      const [tentativaRes, perguntasRes] = tentRes;
      const tentativa = tentativaRes.data?.[0];
      const perguntas = perguntasRes.data ?? [];

      if (tentativa && perguntas.length > 0) {
        const respostas = tentativa.respostas || {};
        const revisao = perguntas.map((p, idx) => {
          const respostaUtilizador = respostas[p.id] ?? respostas[idx] ?? null;
          let correcta = false;

          if (p.tipo === 'resposta_curta') {
            correcta = p.respostas_correctas?.[0]?.toLowerCase?.() === respostaUtilizador?.toLowerCase?.();
          } else if (Array.isArray(p.respostas_correctas)) {
            if (Array.isArray(respostaUtilizador)) {
              correcta = JSON.stringify([...respostaUtilizador].sort()) === JSON.stringify([...p.respostas_correctas].sort());
            } else {
              correcta = p.respostas_correctas.includes(respostaUtilizador);
            }
          }

          return {
            pergunta: p.enunciado,
            tipo: p.tipo,
            opcoes: p.opcoes,
            respostaUtilizador,
            respostasCorrectas: p.respostas_correctas,
            explicacao: p.explicacao,
            correcta,
          };
        });

        setQuizReview({
          tentativa: {
            numero: tentativa.numero_tentativa,
            nota: tentativa.nota_percentagem,
            aprovado: tentativa.aprovado,
            data: tentativa.created_at,
          },
          revisao,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar revisao:', err);
    } finally {
      setLoading(false);
    }
  }

  async function guardarNotas() {
    setSavingNotas(true);
    try {
      const { data, error } = await supabase.from('formacao_notas').upsert({
        empresa_id: empresaId,
        formacao_id: modulo.id,
        colaborador_id: colaboradorId,
        notas: notasTexto,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'formacao_id,colaborador_id' }).select().single();

      if (!error && data) {
        onNotasChange(data);
      }
    } catch (err) {
      console.error('Erro ao guardar notas:', err);
    } finally {
      setSavingNotas(false);
    }
  }

  async function handleDownload(mat) {
    if (mat.url) {
      window.open(mat.url, '_blank');
      return;
    }
    if (mat.file_path) {
      const { data } = await supabase.storage.from('formacao-anexos').createSignedUrl(mat.file_path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    }
  }

  const sections = [
    { key: 'conteudo', label: 'Conteudo', icon: BookOpen },
    { key: 'quiz', label: 'Quiz', icon: HelpCircle, count: quizReview?.revisao?.length },
    { key: 'materiais', label: 'Materiais', icon: FolderOpen, count: materiais.length },
    { key: 'notas', label: 'Notas', icon: StickyNote },
  ];

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{modulo.titulo}</h1>
          <p className="text-xs text-gray-500">{modulo.carga_horaria}h · {modulo.categoria ?? 'geral'}</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {sections.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap ${
              activeSection === key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={13} />
            {label}
            {count > 0 && <span className="ml-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full px-1.5">{count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3"><ListSkeleton rows={4} /></div>
      ) : (
        <>
          {/* Conteudo (seccoes read-only) */}
          {activeSection === 'conteudo' && (
            <div className="space-y-3">
              {seccoes.length === 0 ? (
                <EmptyState icon={BookOpen} text="Sem conteudo disponivel" />
              ) : seccoes.map((s, i) => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{s.titulo}</p>
                      {s.conteudo_texto && (
                        <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed">{s.conteudo_texto}</p>
                      )}
                      {s.conteudo_video_url && (
                        <a href={s.conteudo_video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 mt-2 hover:underline">
                          <LinkIcon size={12} /> Ver video
                        </a>
                      )}
                      {s.conteudo_pdf_url && (
                        <a href={s.conteudo_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 mt-2 hover:underline ml-3">
                          <FileText size={12} /> Ver PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quiz Review */}
          {activeSection === 'quiz' && (
            <div className="space-y-3">
              {!quizReview ? (
                <EmptyState icon={HelpCircle} text="Sem quiz completado" />
              ) : (
                <>
                  {/* Summary */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-800">Resultado</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${quizReview.tentativa.aprovado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {quizReview.tentativa.aprovado ? 'Aprovado' : 'Reprovado'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-800">{quizReview.tentativa.nota}%</p>
                        <p className="text-[10px] text-gray-500">Nota</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{quizReview.revisao.filter(r => r.correcta).length}</p>
                        <p className="text-[10px] text-gray-500">Correctas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{quizReview.revisao.filter(r => !r.correcta).length}</p>
                        <p className="text-[10px] text-gray-500">Erradas</p>
                      </div>
                    </div>
                  </div>

                  {/* Questions */}
                  {quizReview.revisao.map((q, i) => (
                    <div key={i} className={`bg-white rounded-xl border shadow-sm p-4 ${q.correcta ? 'border-green-200' : 'border-red-200'}`}>
                      <div className="flex items-start gap-2 mb-2">
                        {q.correcta ? (
                          <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm font-medium text-gray-800">{q.pergunta}</p>
                      </div>

                      {/* User answer */}
                      <div className="ml-6 space-y-1.5">
                        {q.opcoes && Array.isArray(q.opcoes) ? (
                          q.opcoes.map((op, opIdx) => {
                            const isUserAnswer = Array.isArray(q.respostaUtilizador)
                              ? q.respostaUtilizador.includes(opIdx)
                              : q.respostaUtilizador === opIdx;
                            const isCorrect = q.respostasCorrectas?.includes(opIdx);

                            return (
                              <div key={opIdx} className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                                isCorrect ? 'bg-green-50 text-green-700 font-medium' :
                                isUserAnswer && !isCorrect ? 'bg-red-50 text-red-700' :
                                'text-gray-600'
                              }`}>
                                {isCorrect && <CheckCircle size={12} />}
                                {isUserAnswer && !isCorrect && <XCircle size={12} />}
                                <span>{op}</span>
                                {isUserAnswer && !isCorrect && <span className="text-[10px] italic ml-auto">Sua resposta</span>}
                                {isCorrect && <span className="text-[10px] italic ml-auto">Correcta</span>}
                              </div>
                            );
                          })
                        ) : (
                          <div className="space-y-1">
                            <div className={`text-xs px-2.5 py-1.5 rounded-lg ${q.correcta ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              Sua resposta: {q.respostaUtilizador ?? '(sem resposta)'}
                            </div>
                            {!q.correcta && q.respostasCorrectas?.[0] && (
                              <div className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700">
                                Correcta: {q.respostasCorrectas[0]}
                              </div>
                            )}
                          </div>
                        )}

                        {q.explicacao && (
                          <p className="text-[11px] text-gray-500 italic mt-1 pl-1">{q.explicacao}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Materiais */}
          {activeSection === 'materiais' && (
            <div className="space-y-3">
              {/* Also show module anexos */}
              {materiais.length === 0 && !(modulo.anexos?.length) ? (
                <EmptyState icon={FolderOpen} text="Sem materiais de apoio" />
              ) : (
                <>
                  {materiais.map(m => (
                    <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                      {m.tipo === 'url' ? <LinkIcon size={18} className="text-indigo-500 flex-shrink-0" /> :
                       m.tipo?.includes('pdf') ? <FileText size={18} className="text-red-500 flex-shrink-0" /> :
                       <FolderOpen size={18} className="text-blue-500 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.nome}</p>
                        <p className="text-xs text-gray-400">{m.tipo === 'url' ? 'Link externo' : m.tipo}</p>
                      </div>
                      <button
                        onClick={() => handleDownload(m)}
                        className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ))}
                  {/* Module-level anexos */}
                  {modulo.anexos?.map((a, i) => (
                    <div key={`anexo-${i}`} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                      <FileText size={18} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.nome}</p>
                        <p className="text-xs text-gray-400">Anexo do modulo</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (a.path) {
                            const { data } = await supabase.storage.from('formacao-anexos').createSignedUrl(a.path, 3600);
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                          }
                        }}
                        className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Notas pessoais */}
          {activeSection === 'notas' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">As minhas notas</p>
                  {savingNotas && <span className="text-[10px] text-blue-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> A guardar...</span>}
                </div>
                <textarea
                  ref={notasRef}
                  value={notasTexto}
                  onChange={e => setNotasTexto(e.target.value)}
                  onBlur={guardarNotas}
                  placeholder="Escreva aqui as suas notas pessoais sobre esta formacao... (guarda automaticamente ao sair)"
                  rows={8}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-y bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                />
                <p className="text-[10px] text-gray-400">Estas notas sao privadas e so voce as pode ver.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Shared components
// ────────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? '---'}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="text-center py-12">
      <Icon size={40} className="mx-auto text-gray-200 mb-3" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
