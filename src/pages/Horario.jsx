import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Clock, Moon, Sun, Sunrise } from 'lucide-react';
import { CardSkeleton } from '@/components/Skeleton';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const turnoIcons = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

export default function Horario() {
  const { colaborador } = useAuth();
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchHorario();
  }, [colaborador?.id]);

  async function fetchHorario() {
    const { data } = await supabase
      .from('horarios')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .order('dia_semana', { ascending: true });
    setHorarios(data ?? []);
    setLoading(false);
  }

  // Agrupar por dia
  const porDia = {};
  for (let i = 0; i < 7; i++) porDia[i] = null;
  horarios.forEach(h => { porDia[h.dia_semana] = h; });

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Horário</h1>
      <p className="text-sm text-gray-500">Horário semanal de trabalho</p>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : horarios.length === 0 ? (
        <div className="text-center py-16">
          <Clock size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Horário ainda não definido</p>
          <p className="text-xs text-gray-300 mt-1">O seu empregador definirá o horário.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map(dia => {
            const h = porDia[dia];
            const TurnoIcon = h?.turno ? turnoIcons[h.turno] : null;

            return (
              <div
                key={dia}
                className={`bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between ${
                  h?.folga ? 'border-gray-100 opacity-60' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                    h?.folga ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {DIAS_CURTO[dia]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{DIAS[dia]}</p>
                    {h?.folga ? (
                      <p className="text-xs text-gray-400">Folga</p>
                    ) : h ? (
                      <p className="text-xs text-gray-500">
                        {h.entrada ?? '—'} — {h.saida ?? '—'}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300">Não definido</p>
                    )}
                  </div>
                </div>
                {TurnoIcon && !h?.folga && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <TurnoIcon size={14} />
                    <span className="capitalize">{h.turno}</span>
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
