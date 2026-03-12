// Horario.jsx — V10 "O Meu Horário" (vista do colaborador)
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Clock, ChevronLeft, ChevronRight, Coffee } from 'lucide-react';
import { CardSkeleton } from '@/components/Skeleton';

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const fmtTime = (t) => t ? String(t).substring(0, 5) : '';

const getSegunda = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const fmtData = (d) => d.toISOString().split('T')[0];

const fmtSemana = (seg) => {
  const dom = new Date(seg);
  dom.setDate(dom.getDate() + 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${seg.toLocaleDateString('pt-PT', opts)} — ${dom.toLocaleDateString('pt-PT', opts)}`;
};

const calcHoras = (turno) => {
  if (!turno) return 0;
  const toMins = (t) => {
    const [h, m] = String(t).substring(0, 5).split(':').map(Number);
    return h * 60 + m;
  };
  let mins = toMins(turno.hora_saida) - toMins(turno.hora_entrada);
  if (mins <= 0) mins += 24 * 60;
  if (turno.tipo === 'repartido' && turno.hora_entrada_2 && turno.hora_saida_2) {
    let mins2 = toMins(turno.hora_saida_2) - toMins(turno.hora_entrada_2);
    if (mins2 <= 0) mins2 += 24 * 60;
    return (mins + mins2) / 60;
  }
  return mins / 60;
};

const fmtHoras = (h) => {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h${String(mins).padStart(2, '0')}` : `${hrs}h`;
};

const COR_POSICAO = {
  Sala: '#22c55e', Cozinha: '#eab308', Bar: '#3b82f6', Ilha: '#f97316', Caixa: '#a855f7', Copa: '#14b8a6',
};

export default function Horario() {
  const { colaborador } = useAuth();
  const [semana, setSemana] = useState(() => getSegunda(new Date()));
  const [escala, setEscala] = useState(null);
  const [atribuicoes, setAtribuicoes] = useState([]);
  const [folgas, setFolgas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proximaSemanaPublicada, setProximaSemanaPublicada] = useState(null);

  const semanaStr = fmtData(semana);

  const carregar = useCallback(async () => {
    if (!colaborador?.id || !colaborador?.empresa_id) return;
    setLoading(true);
    try {
      // Obter escala da semana
      const { data: esc } = await supabase
        .from('escalas')
        .select('*')
        .eq('empresa_id', colaborador.empresa_id)
        .eq('semana_inicio', semanaStr)
        .maybeSingle();

      setEscala(esc);

      if (esc) {
        const [{ data: atribs }, { data: folg }] = await Promise.all([
          supabase
            .from('escala_atribuicoes')
            .select('*, turno:turnos(id, nome, cor, hora_entrada, hora_saida, tipo, hora_entrada_2, hora_saida_2)')
            .eq('escala_id', esc.id)
            .eq('colaborador_id', colaborador.id),
          supabase
            .from('escala_folgas')
            .select('*')
            .eq('escala_id', esc.id)
            .eq('colaborador_id', colaborador.id),
        ]);
        setAtribuicoes(atribs ?? []);
        setFolgas(folg ?? []);
      } else {
        setAtribuicoes([]);
        setFolgas([]);
      }

      // Verificar próxima semana
      const proxSeg = new Date(semana);
      proxSeg.setDate(proxSeg.getDate() + 7);
      const { data: proxEsc } = await supabase
        .from('escalas')
        .select('estado')
        .eq('empresa_id', colaborador.empresa_id)
        .eq('semana_inicio', fmtData(proxSeg))
        .maybeSingle();
      setProximaSemanaPublicada(proxEsc?.estado === 'publicada');
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoading(false);
    }
  }, [colaborador?.id, colaborador?.empresa_id, semanaStr]);

  useEffect(() => { carregar(); }, [carregar]);

  const navSemana = (dir) => {
    const nova = new Date(semana);
    nova.setDate(nova.getDate() + (dir * 7));
    setSemana(nova);
  };

  // Organizar por dia (0-6)
  const porDia = {};
  for (let d = 0; d < 7; d++) {
    const atribs = atribuicoes.filter(a => a.dia_semana === d);
    const folga = folgas.find(f => f.dia_semana === d);
    porDia[d] = { atribs, folga };
  }

  // Total horas
  const totalHoras = atribuicoes.reduce((sum, a) => sum + (a.turno ? calcHoras(a.turno) : 0), 0);
  const totalTurnos = atribuicoes.length;

  const isHoje = (dia) => {
    const d = new Date(semana);
    d.setDate(d.getDate() + dia);
    return fmtData(d) === fmtData(new Date());
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">O Meu Horário</h1>

      {/* Navegação semanal */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
        <button onClick={() => navSemana(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800">{fmtSemana(semana)}</p>
          {escala?.estado === 'publicada' ? (
            <span className="text-[10px] text-green-600 font-medium">Publicada</span>
          ) : escala ? (
            <span className="text-[10px] text-gray-400">Rascunho</span>
          ) : (
            <span className="text-[10px] text-gray-300">Sem escala</span>
          )}
        </div>
        <button onClick={() => navSemana(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : !escala || (atribuicoes.length === 0 && folgas.length === 0) ? (
        <div className="text-center py-16">
          <Clock size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Sem horário para esta semana</p>
          <p className="text-xs text-gray-300 mt-1">A escala ainda não foi publicada.</p>
        </div>
      ) : (
        <>
          {/* Lista de dias */}
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map(dia => {
              const { atribs, folga } = porDia[dia];
              const hoje = isHoje(dia);
              const d = new Date(semana);
              d.setDate(d.getDate() + dia);

              return (
                <div key={dia} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                  hoje ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100'
                } ${folga ? 'opacity-70' : ''}`}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center text-xs font-bold ${
                        folga ? 'bg-gray-100 text-gray-400' :
                        hoje ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'
                      }`}>
                        <span className="text-[10px] font-medium leading-none">{DIAS[dia].substring(0, 3)}</span>
                        <span className="text-sm leading-tight">{d.getDate()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{DIAS[dia]}</p>
                        {folga ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Coffee size={12} className="text-gray-400" />
                            <span className="text-xs text-gray-400 capitalize">{folga.tipo === 'ferias' ? 'Férias' : folga.tipo === 'baixa' ? 'Baixa' : 'Folga'}</span>
                          </div>
                        ) : atribs.length > 0 ? (
                          <div className="space-y-0.5 mt-0.5">
                            {atribs.map(a => (
                              <div key={a.id} className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.turno?.cor || '#3b82f6' }} />
                                <span className="text-xs text-gray-600 font-medium">{a.turno?.nome}</span>
                                <span className="text-xs text-gray-400">
                                  {fmtTime(a.turno?.hora_entrada)}–{fmtTime(a.turno?.hora_saida)}
                                  {a.turno?.tipo === 'repartido' && a.turno?.hora_entrada_2 && (
                                    <> + {fmtTime(a.turno.hora_entrada_2)}–{fmtTime(a.turno.hora_saida_2)}</>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-300 mt-0.5">Sem turno</p>
                        )}
                      </div>
                    </div>
                    {/* Posição */}
                    {!folga && atribs.length > 0 && (
                      <div className="flex flex-col items-end gap-0.5">
                        {atribs.map(a => a.posicao && (
                          <span key={a.id} className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: (COR_POSICAO[a.posicao] || '#9ca3af') + '20',
                              color: COR_POSICAO[a.posicao] || '#6b7280',
                            }}>
                            {a.posicao}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumo */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium">Total da semana</p>
                <p className={`text-lg font-bold ${totalHoras > 40 ? 'text-orange-500' : 'text-gray-800'}`}>
                  {fmtHoras(totalHoras)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Turnos</p>
                <p className="text-lg font-bold text-gray-800">{totalTurnos}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Folgas</p>
                <p className="text-lg font-bold text-gray-800">{folgas.length}</p>
              </div>
            </div>
            {totalHoras > 40 && (
              <p className="text-xs text-orange-500 mt-2">Excede as 40h semanais normais</p>
            )}
          </div>

          {/* Próxima semana */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-xs text-gray-400">Próxima semana</p>
            {proximaSemanaPublicada ? (
              <p className="text-sm text-green-600 font-medium mt-1">Escala publicada</p>
            ) : (
              <p className="text-sm text-gray-400 mt-1">Ainda não publicada</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
