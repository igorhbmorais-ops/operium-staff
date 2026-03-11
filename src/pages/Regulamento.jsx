import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { FileText, Check, Download, Loader2, BookOpen, Paperclip, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EmptyState, ListSkeleton } from '@/components/Skeleton';

export default function Regulamento() {
  const { colaborador } = useAuth();
  const toast = useToast();
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(null);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchDocumentos();
  }, [colaborador?.id]);

  async function fetchDocumentos() {
    // Buscar documentos da empresa
    const { data: docs } = await supabase
      .from('documentos_empresa')
      .select('*')
      .eq('empresa_id', colaborador.empresa_id)
      .order('created_at', { ascending: false });

    if (!docs?.length) {
      setDocumentos([]);
      setLoading(false);
      return;
    }

    // Buscar leituras deste colaborador
    const { data: leituras } = await supabase
      .from('leituras_documentos')
      .select('documento_id, lido_em')
      .eq('colaborador_id', colaborador.id);

    const leiturasMap = new Map((leituras ?? []).map(l => [l.documento_id, l.lido_em]));

    setDocumentos(docs.map(d => ({
      ...d,
      lido: leiturasMap.has(d.id),
      lido_em: leiturasMap.get(d.id) ?? null,
    })));
    setLoading(false);
  }

  async function confirmarLeitura(docId) {
    setConfirmando(docId);
    const { error } = await supabase.from('leituras_documentos').insert({
      documento_id: docId,
      colaborador_id: colaborador.id,
    });

    if (!error) {
      toast('Leitura confirmada', 'success');
      setDocumentos(prev => prev.map(d =>
        d.id === docId ? { ...d, lido: true, lido_em: new Date().toISOString() } : d
      ));
    } else {
      toast('Erro ao confirmar leitura', 'error');
    }
    setConfirmando(null);
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Documentos da Empresa</h1>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : documentos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sem documentos disponíveis"
          description="A sua empresa ainda não publicou documentos internos"
        />
      ) : (
        <div className="space-y-3">
          {documentos.map(doc => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700">{doc.titulo}</p>
                  {doc.descricao && (
                    <p className="text-xs text-gray-400 mt-1">{doc.descricao}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Publicado em {formatDate(doc.created_at)}
                  </p>
                </div>
                {doc.lido && (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full shrink-0">
                    <Check size={12} /> Lido
                  </span>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                {doc.ficheiro_path && (
                  <button
                    onClick={async () => {
                      const { data, error } = await supabase.storage
                        .from('documentos-empresa')
                        .createSignedUrl(doc.ficheiro_path, 3600);
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                      else toast('Erro ao abrir ficheiro', 'error');
                    }}
                    className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Paperclip size={14} /> Anexo
                  </button>
                )}
                {doc.documento_url && (
                  <a
                    href={doc.documento_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <ExternalLink size={14} /> Ver documento
                  </a>
                )}
                {!doc.lido && (
                  <button
                    onClick={() => confirmarLeitura(doc.id)}
                    disabled={confirmando === doc.id}
                    className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                  >
                    {confirmando === doc.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Confirmar Leitura
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
