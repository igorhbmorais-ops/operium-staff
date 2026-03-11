import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Bell, Check } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ListSkeleton } from '@/components/Skeleton';

export default function Notificacoes() {
  const { colaborador } = useAuth();
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchNotificacoes();
  }, [colaborador?.id]);

  async function fetchNotificacoes() {
    const { data } = await supabase
      .from('pedidos_ferias')
      .select('id, estado, data_inicio, data_fim, atualizado_em')
      .eq('colaborador_id', colaborador.id)
      .neq('estado', 'pendente')
      .order('atualizado_em', { ascending: false })
      .limit(20);

    const mapped = (data ?? []).map(p => ({
      id: p.id,
      titulo: p.estado === 'aprovado' ? 'Férias Aprovadas' : 'Férias Recusadas',
      mensagem: `Pedido de ${formatDate(p.data_inicio)} a ${formatDate(p.data_fim)} foi ${p.estado}.`,
      tipo: p.estado === 'aprovado' ? 'sucesso' : 'alerta',
      data: p.atualizado_em,
      lida: false,
    }));

    setNotificacoes(mapped);
    setLoading(false);
  }

  const tipoColors = {
    sucesso: 'bg-green-50 border-green-200',
    alerta: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <div className="p-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : notificacoes.length === 0 ? (
        <div className="text-center py-12">
          <Bell size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">Sem notificações</p>
          <p className="text-xs text-gray-300 mt-1">Está tudo em dia!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notificacoes.map(n => (
            <div key={n.id} className={`rounded-xl border p-4 ${tipoColors[n.tipo] ?? 'bg-gray-50 border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{n.titulo}</p>
                  <p className="text-sm text-gray-600 mt-1">{n.mensagem}</p>
                </div>
                {n.lida && <Check size={16} className="text-green-500 mt-1" />}
              </div>
              <p className="text-xs text-gray-400 mt-2">{formatDate(n.data)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
