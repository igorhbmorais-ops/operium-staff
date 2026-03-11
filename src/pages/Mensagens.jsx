import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Send, Users, User, ChevronLeft } from 'lucide-react';
import { cn, formatDate, formatTime } from '@/lib/utils';

export default function Mensagens() {
  const { colaborador } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('direct');
  const [grupos, setGrupos] = useState([]);

  // Direct chat
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Group chat
  const [activeGrupo, setActiveGrupo] = useState(null);
  const [grupoMsgs, setGrupoMsgs] = useState([]);
  const [grupoLoading, setGrupoLoading] = useState(false);
  const [grupoTexto, setGrupoTexto] = useState('');
  const [grupoEnviando, setGrupoEnviando] = useState(false);

  const bottomRef = useRef(null);
  const grupoBottomRef = useRef(null);

  const activeGrupoRef = useRef(activeGrupo);
  useEffect(() => { activeGrupoRef.current = activeGrupo; }, [activeGrupo]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    if (!colaborador?.id) return;
    fetchAll();
  }, [colaborador?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens]);
  useEffect(() => { grupoBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [grupoMsgs]);

  // Polling a cada 5s (WebSocket não funciona)
  useEffect(() => {
    if (!colaborador?.id) return;
    const interval = setInterval(() => {
      // Poll directo se estiver na tab directa
      if (!activeGrupoRef.current) {
        pollDirect();
      } else {
        // Poll grupo ativo
        pollGrupo(activeGrupoRef.current.id);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [colaborador?.id]);

  async function pollDirect() {
    try {
      const { data } = await supabase
        .from('mensagens_staff')
        .select('*')
        .eq('colaborador_id', colaborador.id)
        .order('created_at', { ascending: true });
      if (data) setMensagens(data);
    } catch (_) {}
  }

  async function pollGrupo(grupoId) {
    try {
      const { data } = await supabase
        .from('chat_grupo_mensagens')
        .select('*, colaborador:colaboradores(nome)')
        .eq('grupo_id', grupoId)
        .order('created_at', { ascending: true });
      if (data) setGrupoMsgs(data);
    } catch (_) {}
  }

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchMensagens(), fetchGrupos()]);
    setLoading(false);
  }

  // ========== DIRECT ==========
  async function fetchMensagens() {
    const { data } = await supabase
      .from('mensagens_staff')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .order('created_at', { ascending: true });
    setMensagens(data ?? []);
  }

  async function enviarDirect(e) {
    e.preventDefault();
    const msg = texto.trim();
    if (!msg || enviando) return;
    setEnviando(true);
    const { data, error } = await supabase.from('mensagens_staff').insert({
      user_id: colaborador.user_id,
      empresa_id: colaborador.empresa_id,
      colaborador_id: colaborador.id,
      remetente: 'colaborador',
      mensagem: msg,
    }).select();
    if (!error && data?.[0]) {
      setTexto('');
      setMensagens(prev => prev.some(m => m.id === data[0].id) ? prev : [...prev, data[0]]);
    }
    setEnviando(false);
  }

  // ========== GRUPOS ==========
  async function fetchGrupos() {
    const { data: memberships } = await supabase
      .from('chat_grupo_membros')
      .select('grupo_id')
      .eq('colaborador_id', colaborador.id);

    const grupoIds = (memberships ?? []).map(m => m.grupo_id);
    if (grupoIds.length === 0) { setGrupos([]); return; }

    const { data: gruposData } = await supabase
      .from('chat_grupos')
      .select('id, nome, created_at')
      .in('id', grupoIds)
      .order('created_at', { ascending: false });

    const result = [];
    for (const g of (gruposData || [])) {
      const { data: lastMsg } = await supabase
        .from('chat_grupo_mensagens')
        .select('mensagem, remetente, created_at')
        .eq('grupo_id', g.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const { count } = await supabase
        .from('chat_grupo_membros')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_id', g.id);
      result.push({ ...g, lastMessage: lastMsg?.[0] || null, membrosCount: count || 0 });
    }
    setGrupos(result);
  }

  async function openGrupo(grupo) {
    setActiveGrupo(grupo);
    setGrupoLoading(true);
    const { data } = await supabase
      .from('chat_grupo_mensagens')
      .select('*, colaborador:colaboradores(nome)')
      .eq('grupo_id', grupo.id)
      .order('created_at', { ascending: true });
    setGrupoMsgs(data ?? []);
    setGrupoLoading(false);
  }

  async function enviarGrupo(e) {
    e.preventDefault();
    const msg = grupoTexto.trim();
    if (!msg || grupoEnviando || !activeGrupo) return;
    setGrupoEnviando(true);
    const { data, error } = await supabase.from('chat_grupo_mensagens').insert({
      grupo_id: activeGrupo.id,
      remetente: 'colaborador',
      colaborador_id: colaborador.id,
      mensagem: msg,
    }).select('*, colaborador:colaboradores(nome)');
    if (!error && data?.[0]) {
      setGrupoTexto('');
      setGrupoMsgs(prev => prev.some(m => m.id === data[0].id) ? prev : [...prev, data[0]]);
    }
    setGrupoEnviando(false);
  }

  // ========== HELPERS ==========
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-gray-400">A carregar...</p>
      </div>
    );
  }

  // ========== GROUP CHAT VIEW ==========
  if (activeGrupo) {
    const items = groupByDate(grupoMsgs);
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setActiveGrupo(null)} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Users size={16} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{activeGrupo.nome}</h1>
            <p className="text-[10px] text-gray-400">{activeGrupo.membrosCount} membros</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {grupoLoading ? (
            <p className="text-center py-12 text-gray-400">A carregar...</p>
          ) : grupoMsgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Users size={48} className="text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">Comece a conversa no grupo</p>
            </div>
          ) : (
            items.map(item =>
              item.type === 'date' ? (
                <div key={item.key} className="flex justify-center my-3">
                  <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm">
                    {formatMsgDate(item.date)}
                  </span>
                </div>
              ) : (
                <div key={item.key} className={cn('flex',
                  item.remetente === 'colaborador' && item.colaborador_id === colaborador.id ? 'justify-end' : 'justify-start'
                )}>
                  <div className={cn(
                    'max-w-[80%] rounded-xl px-4 py-2 shadow-sm',
                    item.remetente === 'colaborador' && item.colaborador_id === colaborador.id
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : item.remetente === 'gestor'
                        ? 'bg-emerald-500 text-white rounded-bl-sm'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  )}>
                    {!(item.remetente === 'colaborador' && item.colaborador_id === colaborador.id) && (
                      <p className={cn('text-[10px] font-semibold mb-0.5',
                        item.remetente === 'gestor' ? 'text-emerald-100' : 'text-blue-600'
                      )}>
                        {item.remetente === 'gestor' ? 'Gestor' : (item.colaborador?.nome || 'Colaborador')}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{item.mensagem}</p>
                    <p className={cn('text-[10px] mt-1 text-right',
                      item.remetente === 'colaborador' && item.colaborador_id === colaborador.id ? 'text-blue-100'
                      : item.remetente === 'gestor' ? 'text-emerald-100'
                      : 'text-gray-400'
                    )}>
                      {formatTime(item.created_at)}
                    </p>
                  </div>
                </div>
              )
            )
          )}
          <div ref={grupoBottomRef} />
        </div>

        <form onSubmit={enviarGrupo} className="bg-white border-t px-4 py-3 flex gap-2">
          <input
            type="text"
            value={grupoTexto}
            onChange={e => setGrupoTexto(e.target.value)}
            placeholder="Mensagem no grupo..."
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={grupoEnviando}
          />
          <button
            type="submit"
            disabled={!grupoTexto.trim() || grupoEnviando}
            className={cn('rounded-xl p-2 transition-colors',
              grupoTexto.trim() && !grupoEnviando ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-400'
            )}
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    );
  }

  // ========== MAIN VIEW ==========
  const directItems = groupByDate(mensagens);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header + Tabs */}
      <div className="bg-white border-b">
        <div className="px-4 pt-3 pb-0">
          <h1 className="text-lg font-bold text-gray-900">Mensagens</h1>
        </div>
        <div className="flex px-4 mt-2">
          <button
            onClick={() => setActiveTab('direct')}
            className={cn('flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'direct' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'
            )}
          >
            <div className="flex items-center justify-center gap-1.5">
              <User size={16} /> Gestor
            </div>
          </button>
          <button
            onClick={() => setActiveTab('grupos')}
            className={cn('flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'grupos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'
            )}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Users size={16} /> Grupos
              {grupos.length > 0 && (
                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{grupos.length}</span>
              )}
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'direct' ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {mensagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare size={48} className="text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">Envie uma mensagem ao seu gestor</p>
              </div>
            ) : (
              directItems.map(item =>
                item.type === 'date' ? (
                  <div key={item.key} className="flex justify-center my-3">
                    <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm">
                      {formatMsgDate(item.date)}
                    </span>
                  </div>
                ) : (
                  <div key={item.key} className={cn('flex', item.remetente === 'colaborador' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[80%] rounded-xl px-4 py-2 shadow-sm',
                      item.remetente === 'colaborador'
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                    )}>
                      <p className="text-sm whitespace-pre-wrap break-words">{item.mensagem}</p>
                      <p className={cn('text-[10px] mt-1 text-right', item.remetente === 'colaborador' ? 'text-blue-100' : 'text-gray-400')}>
                        {formatTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                )
              )
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={enviarDirect} className="bg-white border-t px-4 py-3 flex gap-2">
            <input
              type="text"
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Escreva uma mensagem..."
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={enviando}
            />
            <button
              type="submit"
              disabled={!texto.trim() || enviando}
              className={cn('rounded-xl p-2 transition-colors',
                texto.trim() && !enviando ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-400'
              )}
            >
              <Send size={20} />
            </button>
          </form>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {grupos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Users size={48} className="text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">Não pertence a nenhum grupo</p>
              <p className="text-xs text-gray-300 mt-1">O seu gestor pode criar grupos e adicioná-lo</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {grupos.map(g => (
                <button
                  key={g.id}
                  onClick={() => openGrupo(g)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-white transition-colors active:bg-gray-100"
                >
                  <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Users size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900 truncate">{g.nome}</p>
                      {g.lastMessage && (
                        <span className="text-[10px] text-gray-400 shrink-0 ml-2">{formatTime(g.lastMessage.created_at)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {g.lastMessage ? g.lastMessage.mensagem : `${g.membrosCount} membros`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
