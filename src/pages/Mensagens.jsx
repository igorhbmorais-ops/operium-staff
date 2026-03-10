import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Send } from 'lucide-react';
import { cn, formatDate, formatTime } from '@/lib/utils';

export default function Mensagens() {
  const { colaborador } = useAuth();
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchMensagens();

    const channel = supabase
      .channel('mensagens_staff_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens_staff',
          filter: `colaborador_id=eq.${colaborador.id}`,
        },
        (payload) => {
          setMensagens((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [colaborador?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function fetchMensagens() {
    const { data } = await supabase
      .from('mensagens_staff')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .order('created_at', { ascending: true });

    setMensagens(data ?? []);
    setLoading(false);
  }

  async function enviarMensagem(e) {
    e.preventDefault();
    const msg = texto.trim();
    if (!msg || enviando) return;

    setEnviando(true);
    const { error } = await supabase.from('mensagens_staff').insert({
      user_id: colaborador.user_id,
      empresa_id: colaborador.empresa_id,
      colaborador_id: colaborador.id,
      remetente: 'colaborador',
      mensagem: msg,
    });

    if (!error) {
      setTexto('');
    }
    setEnviando(false);
  }

  function formatMsgDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoje';
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return formatDate(dateStr);
  }

  function groupByDate(msgs) {
    const groups = [];
    let currentDate = null;

    for (const msg of msgs) {
      const dateKey = new Date(msg.created_at).toDateString();
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ type: 'date', date: msg.created_at, key: `date-${dateKey}` });
      }
      groups.push({ type: 'msg', ...msg, key: msg.id });
    }

    return groups;
  }

  const items = groupByDate(mensagens);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Mensagens</h1>
        <p className="text-xs text-gray-500">Conversa com o seu gestor</p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">A carregar...</p>
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare size={48} className="text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">Envie uma mensagem ao seu gestor</p>
          </div>
        ) : (
          items.map((item) =>
            item.type === 'date' ? (
              <div key={item.key} className="flex justify-center my-3">
                <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm">
                  {formatMsgDate(item.date)}
                </span>
              </div>
            ) : (
              <div
                key={item.key}
                className={cn(
                  'flex',
                  item.remetente === 'colaborador' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-4 py-2 shadow-sm',
                    item.remetente === 'colaborador'
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{item.mensagem}</p>
                  <p
                    className={cn(
                      'text-[10px] mt-1 text-right',
                      item.remetente === 'colaborador' ? 'text-blue-100' : 'text-gray-400'
                    )}
                  >
                    {formatTime(item.created_at)}
                  </p>
                </div>
              </div>
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={enviarMensagem} className="bg-white border-t px-4 py-3 flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={enviando}
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className={cn(
            'rounded-xl p-2 transition-colors',
            texto.trim() && !enviando
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-100 text-gray-400'
          )}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
