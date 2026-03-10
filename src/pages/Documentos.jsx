import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FileText, GraduationCap, Stethoscope, ScrollText, Download } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';

const tabs = [
  { id: 'recibos', label: 'Recibos', icon: FileText },
  { id: 'contrato', label: 'Contrato', icon: ScrollText },
  { id: 'formacao', label: 'Formação', icon: GraduationCap },
  { id: 'exames', label: 'Exames', icon: Stethoscope },
];

export default function Documentos() {
  const { colaborador } = useAuth();
  const [activeTab, setActiveTab] = useState('recibos');
  const [recibos, setRecibos] = useState([]);
  const [formacoes, setFormacoes] = useState([]);
  const [exames, setExames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchAll();
  }, [colaborador?.id]);

  async function fetchAll() {
    setLoading(true);
    const [recRes, formRes, examRes] = await Promise.all([
      supabase
        .from('recibos_salario')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false }),
      supabase
        .from('formacoes')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .order('data', { ascending: false }),
      supabase
        .from('exames_medicos')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .order('data', { ascending: false }),
    ]);
    setRecibos(recRes.data ?? []);
    setFormacoes(formRes.data ?? []);
    setExames(examRes.data ?? []);
    setLoading(false);
  }

  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Horas de formação cumpridas este ano
  const anoActual = new Date().getFullYear();
  const horasAno = formacoes
    .filter(f => f.data && new Date(f.data).getFullYear() === anoActual)
    .reduce((sum, f) => sum + (Number(f.horas) || 0), 0);

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">A carregar...</div>
      ) : (
        <>
          {/* Recibos */}
          {activeTab === 'recibos' && (
            <div className="space-y-3">
              {recibos.length === 0 ? (
                <EmptyState icon={FileText} text="Sem recibos disponíveis" />
              ) : recibos.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {meses[(r.mes ?? 1) - 1]} {r.ano}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.estado === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
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
                      <p className="text-xs text-gray-500">Líquido</p>
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

          {/* Formação */}
          {activeTab === 'formacao' && (
            <div className="space-y-3">
              {/* Progresso anual */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">Progresso {anoActual}</p>
                  <p className="text-sm font-bold text-blue-600">{horasAno}h / 40h</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="bg-blue-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (horasAno / 40) * 100)}%` }}
                  />
                </div>
              </div>

              {formacoes.length === 0 ? (
                <EmptyState icon={GraduationCap} text="Sem formações registadas" />
              ) : formacoes.map(f => (
                <div key={f.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{f.nome}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.horas}h · {f.tipo ?? 'voluntária'}</p>
                    {f.validade && (
                      <p className={`text-xs mt-1 ${new Date(f.validade) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {new Date(f.validade) < new Date() ? 'Expirado' : `Válido até ${formatDate(f.validade)}`}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(f.data)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Exames Médicos */}
          {activeTab === 'exames' && (
            <div className="space-y-3">
              {exames.length === 0 ? (
                <EmptyState icon={Stethoscope} text="Sem exames registados" />
              ) : exames.map(e => {
                const resultColor = {
                  apto: 'bg-green-100 text-green-700',
                  apto_condicional: 'bg-yellow-100 text-yellow-700',
                  inapto: 'bg-red-100 text-red-700',
                };
                return (
                  <div key={e.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-800 capitalize">{e.tipo}</p>
                      {e.resultado && (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${resultColor[e.resultado] ?? 'bg-gray-100 text-gray-600'}`}>
                          {e.resultado.replace('_', ' ')}
                        </span>
                      )}
                      {e.proximo_exame && (
                        <p className="text-xs text-gray-400 mt-1">
                          Próximo: {formatDate(e.proximo_exame)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(e.data)}</span>
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

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium">{value ?? '—'}</span>
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
