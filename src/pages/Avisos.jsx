import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Bell, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EmptyState, ListSkeleton } from '@/components/Skeleton';

export default function Avisos() {
  const { colaborador } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchAvisos();
  }, [colaborador?.id]);

  async function fetchAvisos() {
    const hoje = new Date().toISOString().split('T')[0];

    const { data: allAvisos } = await supabase
      .from('avisos_staff')
      .select('*')
      .eq('empresa_id', colaborador.empresa_id)
      .or(`data_publicacao.is.null,data_publicacao.lte.${hoje}`)
      .order('created_at', { ascending: false });

    // Filtrar por destinatários (null = todos, array = específicos)
    const filtered = (allAvisos ?? []).filter(a =>
      !a.destinatarios || a.destinatarios.includes(colaborador.id)
    );

    setAvisos(filtered);
    setLoading(false);
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className="flex items-center gap-2">
        <Bell size={22} className="text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">Avisos</h1>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : avisos.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Sem avisos"
          description="Não existem avisos para si de momento"
        />
      ) : (
        <div className="space-y-3">
          {avisos.map(aviso => (
            <div
              key={aviso.id}
              className={`bg-white rounded-xl border shadow-sm p-4 ${
                aviso.prioridade === 'urgente'
                  ? 'border-red-200 bg-red-50/30'
                  : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg ${
                  aviso.prioridade === 'urgente'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-orange-100 text-orange-600'
                }`}>
                  {aviso.prioridade === 'urgente'
                    ? <AlertTriangle size={16} />
                    : <Bell size={16} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800">{aviso.titulo}</p>
                    {aviso.prioridade === 'urgente' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">
                        Urgente
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line leading-relaxed">
                    {aviso.mensagem}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDate(aviso.data_publicacao || aviso.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
