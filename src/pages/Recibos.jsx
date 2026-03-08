import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FileText, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function Recibos() {
  const { colaborador } = useAuth();
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchRecibos();
  }, [colaborador?.id]);

  async function fetchRecibos() {
    const { data } = await supabase
      .from('recibos_salario')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .order('mes_referencia', { ascending: false });

    setRecibos(data ?? []);
    setLoading(false);
  }

  async function downloadRecibo(recibo) {
    if (!recibo.pdf_url) return;
    window.open(recibo.pdf_url, '_blank');
  }

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  function formatMesRef(mesRef) {
    if (!mesRef) return '—';
    const [ano, mes] = mesRef.split('-');
    return `${meses[parseInt(mes) - 1]} ${ano}`;
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Recibos de Vencimento</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : recibos.length === 0 ? (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Sem recibos disponíveis</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recibos.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{formatMesRef(r.mes_referencia)}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(r.valor_liquido)}</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-400">
                    <span>Bruto: {formatCurrency(r.valor_bruto)}</span>
                    <span>Descontos: {formatCurrency(r.descontos)}</span>
                  </div>
                </div>
                {r.pdf_url && (
                  <button
                    onClick={() => downloadRecibo(r)}
                    className="p-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                    title="Descarregar PDF"
                  >
                    <Download size={20} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
