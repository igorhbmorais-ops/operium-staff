import { useAuth } from '@/contexts/AuthContext';
import { useSecurity } from '@/contexts/SecurityContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Clock, CalendarDays, Wallet, Bell, ArrowRight, AlertTriangle, Megaphone, X,
  Users, ClipboardList, MapPin, Loader2, CheckCircle2, AlertCircle, Camera,
  GraduationCap, Stethoscope, FileText, CalendarCheck, ChevronRight, Coffee,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getDeviceFingerprint } from '@/lib/security';
import { formatTime, formatCurrency, formatDate } from '@/lib/utils';

// ---- Ponto helpers (from Ponto.jsx) ----
function SelfieCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    let mediaStream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(s => {
        mediaStream = s;
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => onCancel());
    return () => { if (mediaStream) mediaStream.getTracks().forEach(t => t.stop()); };
  }, []);

  function capturar() {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      onCapture(blob);
    }, 'image/jpeg', 0.8);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
        <div className="p-3 text-center">
          <p className="text-sm font-semibold text-gray-700">Verificacao de identidade</p>
          <p className="text-xs text-gray-400">Posicione o rosto no centro</p>
        </div>
        <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-square object-cover" />
        <div className="flex gap-2 p-3">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-lg">Cancelar</button>
          <button onClick={capturar} className="flex-1 py-2.5 text-sm text-white bg-blue-600 rounded-lg flex items-center justify-center gap-1">
            <Camera size={16} /> Capturar
          </button>
        </div>
      </div>
    </div>
  );
}

const fmtShiftTime = (t) => t ? String(t).substring(0, 5) : '';

export default function Home() {
  const { colaborador } = useAuth();
  const { config } = useSecurity();
  const toast = useToast();
  const navigate = useNavigate();

  // Ponto state
  const [registosHoje, setRegistosHoje] = useState([]);
  const [pontoLoading, setPontoLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [pontoLocation, setPontoLocation] = useState(null);
  const [pontoFeedback, setPontoFeedback] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  // Shift info
  const [turnoHoje, setTurnoHoje] = useState(null);
  const [turnoLoading, setTurnoLoading] = useState(true);

  // Dashboard data
  const [saldoFerias, setSaldoFerias] = useState(null);
  const [ultimoRecibo, setUltimoRecibo] = useState(null);
  const [horasSemana, setHorasSemana] = useState(0);
  const [avisos, setAvisos] = useState([]);
  const [expandedAviso, setExpandedAviso] = useState(null);
  const [readAvisos, setReadAvisos] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('readAvisos') || '[]')); }
    catch { return new Set(); }
  });

  // Tarefas pendentes
  const [tarefas, setTarefas] = useState([]);
  const [pendenciasEquipa, setPendenciasEquipa] = useState(0);
  const [avaliacoesPendentes, setAvaliacoesPendentes] = useState(0);

  // Elapsed time ticker
  const [elapsed, setElapsed] = useState('');

  const primeiroNome = colaborador?.nome?.split(' ')[0] ?? 'Colaborador';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 19 ? 'Boa tarde' : 'Boa noite';
  const hoje = new Date().toISOString().slice(0, 10);
  const anoActual = new Date().getFullYear();

  const isGestor = colaborador?.cargo?.nivel != null && colaborador.cargo.nivel <= 2;

  // ----- Fetch all data -----
  useEffect(() => {
    if (!colaborador?.id) return;

    // Ponto registos hoje
    fetchRegistos();

    // Turno de hoje (from escala)
    fetchTurnoHoje();

    // Saldo ferias
    supabase
      .from('saldo_ferias')
      .select('dias_direito, dias_gozados, dias_marcados, dias_transitados')
      .eq('colaborador_id', colaborador.id)
      .eq('ano', anoActual)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const total = (data.dias_direito ?? 0) + (data.dias_transitados ?? 0);
          setSaldoFerias({
            disponiveis: total - (data.dias_gozados ?? 0) - (data.dias_marcados ?? 0),
          });
        }
      });

    // Ultimo recibo
    supabase
      .from('recibos_salario')
      .select('liquido, ano, mes')
      .eq('colaborador_id', colaborador.id)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setUltimoRecibo(data[0]);
      });

    // Horas da semana
    fetchHorasSemana();

    // Avisos
    supabase
      .from('avisos_staff')
      .select('*')
      .or(`data_publicacao.is.null,data_publicacao.lte.${hoje}`)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        const filtered = (data ?? []).filter(a =>
          !a.destinatarios || a.destinatarios.includes(colaborador.id)
        );
        setAvisos(filtered);
      });

    // Avaliacoes pendentes
    supabase
      .from('avaliacoes_360')
      .select('id', { count: 'exact', head: true })
      .eq('avaliador_id', colaborador.id)
      .neq('estado', 'submetida')
      .then(({ count }) => setAvaliacoesPendentes(count ?? 0));

    // Build tarefas pendentes
    fetchTarefas();
  }, [colaborador?.id]);

  // Pendencias equipa (gestores)
  useEffect(() => {
    if (!isGestor || !colaborador?.cargo_id || !colaborador?.empresa_id) return;

    (async () => {
      const { data: cargosFilho } = await supabase
        .from('cargos')
        .select('id')
        .eq('superior_id', colaborador.cargo_id)
        .eq('empresa_id', colaborador.empresa_id);

      const cargoIds = (cargosFilho ?? []).map(c => c.id);
      if (cargoIds.length === 0) return;

      const { data: subs } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('empresa_id', colaborador.empresa_id)
        .in('cargo_id', cargoIds)
        .eq('activo', true);

      const subIds = (subs ?? []).map(s => s.id);
      if (subIds.length === 0) return;

      const [ferRes, despRes] = await Promise.all([
        supabase.from('pedidos_ferias').select('id', { count: 'exact', head: true })
          .in('colaborador_id', subIds).eq('estado', 'pendente'),
        supabase.from('despesas_colaborador').select('id', { count: 'exact', head: true })
          .in('colaborador_id', subIds).eq('estado', 'pendente'),
      ]);

      setPendenciasEquipa((ferRes.count ?? 0) + (despRes.count ?? 0));
    })();
  }, [isGestor, colaborador?.cargo_id, colaborador?.empresa_id]);

  // Elapsed time ticker
  useEffect(() => {
    const ultimo = registosHoje[registosHoje.length - 1];
    if (ultimo?.tipo !== 'entrada') { setElapsed(''); return; }

    const tick = () => {
      const diff = Date.now() - new Date(ultimo.hora).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(`${h}h ${String(m).padStart(2, '0')}min`);
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [registosHoje]);

  async function fetchRegistos() {
    const { data } = await supabase
      .from('ponto_registos')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .eq('data', hoje)
      .order('hora', { ascending: true });
    setRegistosHoje(data ?? []);
  }

  async function fetchTurnoHoje() {
    if (!colaborador?.empresa_id) { setTurnoLoading(false); return; }
    try {
      // Determine dia_semana (0=Segunda..6=Domingo)
      const jsDay = new Date().getDay(); // 0=Sun
      const diaSemana = jsDay === 0 ? 6 : jsDay - 1;

      // Get this week's Monday
      const now = new Date();
      const dayOff = now.getDay();
      const diff = now.getDate() - dayOff + (dayOff === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      const semanaInicio = monday.toISOString().split('T')[0];

      const { data: esc } = await supabase
        .from('escalas')
        .select('id, estado')
        .eq('empresa_id', colaborador.empresa_id)
        .eq('semana_inicio', semanaInicio)
        .maybeSingle();

      if (esc) {
        const { data: atribs } = await supabase
          .from('escala_atribuicoes')
          .select('*, turno:turnos(id, nome, cor, hora_entrada, hora_saida, tipo, hora_entrada_2, hora_saida_2)')
          .eq('escala_id', esc.id)
          .eq('colaborador_id', colaborador.id)
          .eq('dia_semana', diaSemana);

        if (atribs?.length > 0) {
          setTurnoHoje(atribs[0]);
        }

        // Check for folga
        if (!atribs?.length) {
          const { data: folg } = await supabase
            .from('escala_folgas')
            .select('tipo')
            .eq('escala_id', esc.id)
            .eq('colaborador_id', colaborador.id)
            .eq('dia_semana', diaSemana)
            .maybeSingle();

          if (folg) {
            setTurnoHoje({ folga: true, folgaTipo: folg.tipo });
          }
        }
      }
    } catch (e) {
      console.error('Erro turno:', e);
    } finally {
      setTurnoLoading(false);
    }
  }

  async function fetchHorasSemana() {
    // Get Monday of current week
    const now = new Date();
    const dayOff = now.getDay();
    const diff = now.getDate() - dayOff + (dayOff === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    const mondayStr = monday.toISOString().split('T')[0];

    const { data } = await supabase
      .from('ponto_registos')
      .select('data, tipo, hora')
      .eq('colaborador_id', colaborador.id)
      .gte('data', mondayStr)
      .lte('data', hoje)
      .order('data')
      .order('hora', { ascending: true });

    if (!data?.length) return;

    // Group by day, compute hours
    const porDia = {};
    data.forEach(r => {
      if (!porDia[r.data]) porDia[r.data] = [];
      porDia[r.data].push(r);
    });

    let total = 0;
    Object.values(porDia).forEach(regs => {
      for (let i = 0; i < regs.length - 1; i += 2) {
        if (regs[i]?.hora && regs[i + 1]?.hora) {
          total += (new Date(regs[i + 1].hora) - new Date(regs[i].hora)) / 3600000;
        }
      }
    });
    setHorasSemana(Math.round(total * 10) / 10);
  }

  async function fetchTarefas() {
    const tasks = [];

    // Documentos por ler
    try {
      const { data: docs } = await supabase
        .from('documentos_empresa')
        .select('id')
        .eq('empresa_id', colaborador.empresa_id)
        .eq('requer_leitura', true);

      if (docs?.length) {
        const { data: lidos } = await supabase
          .from('leituras_documentos')
          .select('documento_id')
          .eq('colaborador_id', colaborador.id);

        const lidosSet = new Set((lidos ?? []).map(l => l.documento_id));
        const naoLidos = docs.filter(d => !lidosSet.has(d.id));
        if (naoLidos.length > 0) {
          tasks.push({
            label: `${naoLidos.length} documento${naoLidos.length > 1 ? 's' : ''} por ler`,
            icon: FileText,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            path: '/regulamento',
          });
        }
      }
    } catch {}

    // Proximo exame medico (30 dias)
    try {
      const { data: exames } = await supabase
        .from('exames_medicos')
        .select('proximo_exame')
        .eq('colaborador_id', colaborador.id)
        .not('proximo_exame', 'is', null)
        .order('proximo_exame', { ascending: true })
        .limit(1);

      if (exames?.[0]?.proximo_exame) {
        const diff = Math.ceil((new Date(exames[0].proximo_exame) - new Date()) / 86400000);
        if (diff > 0 && diff <= 30) {
          tasks.push({
            label: `Exame medico em ${diff} dia${diff > 1 ? 's' : ''}`,
            icon: Stethoscope,
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            path: '/documentos',
          });
        }
      }
    } catch {}

    // Formacao em curso
    try {
      const { data: fSessoes } = await supabase
        .from('formacao_sessoes')
        .select('id')
        .eq('colaborador_id', colaborador.id)
        .eq('estado', 'em_curso')
        .limit(1);

      if (fSessoes?.length) {
        tasks.push({
          label: 'Formacao em curso',
          icon: GraduationCap,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
          path: '/documentos',
        });
      }
    } catch {}

    // Ferias — check if no ferias marcadas this year
    try {
      const { count } = await supabase
        .from('pedidos_ferias')
        .select('id', { count: 'exact', head: true })
        .eq('colaborador_id', colaborador.id)
        .gte('data_inicio', `${anoActual}-01-01`);

      if ((count ?? 0) === 0) {
        tasks.push({
          label: 'Ferias por marcar',
          icon: CalendarCheck,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          path: '/ferias',
        });
      }
    } catch {}

    setTarefas(tasks);
  }

  // ----- Ponto logic (reused from Ponto.jsx) -----
  const ultimoRegisto = registosHoje[registosHoje.length - 1];
  const proximoTipo = !ultimoRegisto || ultimoRegisto.tipo === 'saida' ? 'entrada' : 'saida';
  const emTurno = ultimoRegisto?.tipo === 'entrada';

  let horasTrabalhadas = 0;
  for (let i = 0; i < registosHoje.length - 1; i += 2) {
    if (registosHoje[i]?.hora && registosHoje[i + 1]?.hora) {
      horasTrabalhadas += (new Date(registosHoje[i + 1].hora) - new Date(registosHoje[i].hora)) / 3600000;
    }
  }
  if (emTurno && ultimoRegisto?.hora) {
    horasTrabalhadas += (Date.now() - new Date(ultimoRegisto.hora).getTime()) / 3600000;
  }

  const turnoConcluido = registosHoje.length > 0 && !emTurno;

  function obterLocalizacao() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocalizacao nao disponivel')); return; }
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPontoLocation(loc);
          setGeoLoading(false);
          resolve(loc);
        },
        () => { setGeoLoading(false); reject(new Error('Nao foi possivel obter localizacao.')); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function uploadSelfie(blob) {
    const filename = `${colaborador.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('selfies').upload(filename, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error('Erro ao guardar selfie');
    const { data: urlData } = supabase.storage.from('selfies').getPublicUrl(filename);
    return urlData.publicUrl;
  }

  async function registarPonto(selfieBlob = null) {
    setPontoLoading(true);
    setPontoFeedback(null);
    try {
      let loc = pontoLocation;
      if (!loc) loc = await obterLocalizacao();

      let selfieFinalUrl = null;
      if (selfieBlob) {
        selfieFinalUrl = await uploadSelfie(selfieBlob);
      }

      const agora = new Date();
      const insertData = {
        user_id: colaborador.user_id,
        empresa_id: colaborador.empresa_id ?? null,
        colaborador_id: colaborador.id,
        tipo: proximoTipo,
        data: agora.toISOString().slice(0, 10),
        hora: agora.toISOString(),
        modo: 'app',
        registado_por: 'colaborador',
        latitude: loc.lat,
        longitude: loc.lng,
        device_fingerprint: getDeviceFingerprint(),
        pin_verificado: true,
      };
      if (selfieFinalUrl) insertData.selfie_url = selfieFinalUrl;

      const { error } = await supabase.from('ponto_registos').insert(insertData);
      if (error) throw error;

      const msg = proximoTipo === 'entrada' ? 'Entrada registada!' : 'Saida registada!';
      toast(msg, 'success');
      setPontoFeedback({ type: 'success', msg });
      await fetchRegistos();
    } catch (err) {
      toast(err.message, 'error');
      setPontoFeedback({ type: 'error', msg: err.message });
    } finally {
      setPontoLoading(false);
    }
  }

  function handlePontoClick() {
    if (config?.exigir_selfie) {
      setShowCamera(true);
    } else {
      registarPonto();
    }
  }

  // Aviso helpers
  const markAsRead = (id) => {
    setReadAvisos(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('readAvisos', JSON.stringify([...next]));
      return next;
    });
    setExpandedAviso(id);
  };

  const unreadAvisos = avisos.filter(a => !readAvisos.has(a.id));
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Total pending count for badge
  const totalPending = tarefas.length + avaliacoesPendentes + (pendenciasEquipa > 0 ? 1 : 0);

  return (
    <div className="pb-24">
      {showCamera && (
        <SelfieCapture onCapture={(blob) => { setShowCamera(false); registarPonto(blob); }} onCancel={() => setShowCamera(false)} />
      )}

      {/* ===== HEADER with gradient ===== */}
      <div className="bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold text-white">{saudacao}, {primeiroNome}</h1>
            <p className="text-sm text-blue-200/70">
              {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button
            onClick={() => navigate('/avisos')}
            className="relative w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <Bell size={20} className="text-white" />
            {unreadAvisos.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadAvisos.length > 9 ? '9+' : unreadAvisos.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-4">
        {/* ===== PONTO DE HOJE — Hero Card ===== */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/60 overflow-hidden">
          <div className={`p-5 ${
            emTurno
              ? 'bg-gradient-to-r from-green-500 to-emerald-600'
              : turnoConcluido
                ? 'bg-gradient-to-r from-slate-600 to-slate-700'
                : 'bg-gradient-to-r from-blue-500 to-blue-600'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-white/80" />
              <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">Ponto de Hoje</p>
            </div>

            {/* Shift info */}
            {turnoLoading ? (
              <div className="h-8 bg-white/20 rounded-lg w-48 animate-pulse mb-3" />
            ) : turnoHoje?.folga ? (
              <div className="flex items-center gap-2 mb-3">
                <Coffee size={18} className="text-white/80" />
                <p className="text-white font-medium text-sm">
                  {turnoHoje.folgaTipo === 'ferias' ? 'Ferias' : turnoHoje.folgaTipo === 'baixa' ? 'Baixa' : 'Folga'}
                </p>
              </div>
            ) : turnoHoje?.turno ? (
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: turnoHoje.turno.cor || '#fff' }} />
                  <p className="text-white font-semibold text-sm">{turnoHoje.turno.nome}</p>
                  <span className="text-white/70 text-xs">
                    {fmtShiftTime(turnoHoje.turno.hora_entrada)} - {fmtShiftTime(turnoHoje.turno.hora_saida)}
                  </span>
                </div>
                {turnoHoje.posicao && (
                  <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">
                    {turnoHoje.posicao}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-white/70 text-sm mb-3">Sem turno atribuido</p>
            )}

            {/* Status */}
            {emTurno && ultimoRegisto?.hora && (
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-white/90 text-xs font-medium">Entrada: {formatTime(ultimoRegisto.hora)}</span>
                </div>
                {elapsed && (
                  <span className="text-white/70 text-xs">({elapsed})</span>
                )}
              </div>
            )}

            {turnoConcluido && (
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-white/80" />
                <span className="text-white/90 text-xs font-medium">
                  Turno concluido - {horasTrabalhadas.toFixed(1)}h
                </span>
              </div>
            )}

            {/* Ponto button */}
            {!(turnoHoje?.folga) && (
              <button
                onClick={handlePontoClick}
                disabled={pontoLoading || geoLoading}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${
                  emTurno
                    ? 'bg-white text-orange-600 shadow-lg'
                    : 'bg-white text-green-600 shadow-lg'
                }`}
              >
                {pontoLoading || geoLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Clock size={18} />
                    <span>{emTurno ? 'Registar Saida' : 'Registar Entrada'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Feedback */}
          {pontoFeedback && (
            <div className={`px-5 py-3 text-sm flex items-center gap-2 ${
              pontoFeedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {pontoFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {pontoFeedback.msg}
            </div>
          )}

          {/* Today's records summary */}
          {registosHoje.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {registosHoje.map((r, i) => (
                    <span key={i} className={`w-2 h-2 rounded-full ${r.tipo === 'entrada' ? 'bg-green-500' : 'bg-orange-400'}`} />
                  ))}
                  <span className="text-xs text-gray-400">{registosHoje.length} registo{registosHoje.length > 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={() => navigate('/ponto')}
                  className="text-xs text-blue-600 font-medium flex items-center gap-0.5"
                >
                  Ver detalhes <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===== TAREFAS PENDENTES ===== */}
        {(tarefas.length > 0 || avaliacoesPendentes > 0) && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Tarefas Pendentes</h2>

            {avaliacoesPendentes > 0 && (
              <button
                onClick={() => navigate('/avaliacoes')}
                className="w-full bg-white rounded-xl border border-purple-100 shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] transition-all"
              >
                <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                  <ClipboardList size={18} className="text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-800">
                    {avaliacoesPendentes} avaliacao{avaliacoesPendentes > 1 ? 'oes' : ''} pendente{avaliacoesPendentes > 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            )}

            {tarefas.map((t, i) => (
              <button
                key={i}
                onClick={() => navigate(t.path)}
                className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3 active:scale-[0.99] transition-all"
              >
                <div className={`w-9 h-9 ${t.bg} rounded-lg flex items-center justify-center`}>
                  <t.icon size={18} className={t.color} />
                </div>
                <p className="flex-1 text-left text-sm font-medium text-gray-800">{t.label}</p>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        )}

        {/* ===== PENDENCIAS EQUIPA (gestores) ===== */}
        {isGestor && pendenciasEquipa > 0 && (
          <button
            onClick={() => navigate('/equipa')}
            className="w-full bg-white rounded-2xl border border-blue-200 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-800">Pendencias da Equipa</p>
              <p className="text-xs text-gray-500">{pendenciasEquipa} item{pendenciasEquipa !== 1 ? 's' : ''} por aprovar</p>
            </div>
            <span className="w-7 h-7 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {pendenciasEquipa > 9 ? '9+' : pendenciasEquipa}
            </span>
          </button>
        )}

        {/* ===== RESUMO RAPIDO — 3 mini-cards ===== */}
        <div className="grid grid-cols-3 gap-3">
          <MiniCard
            label="Horas"
            value={`${horasSemana}h`}
            sub="esta semana"
            bgColor="bg-blue-50"
            textColor="text-blue-700"
            subColor="text-blue-400"
            progress={Math.min(100, (horasSemana / 40) * 100)}
            progressColor="bg-blue-400"
            onClick={() => navigate('/ponto')}
          />
          <MiniCard
            label="Ferias"
            value={saldoFerias ? `${saldoFerias.disponiveis}` : '--'}
            sub="dias restantes"
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            subColor="text-emerald-400"
            onClick={() => navigate('/ferias')}
          />
          <MiniCard
            label="Salario"
            value={ultimoRecibo ? formatCurrency(ultimoRecibo.liquido) : '--'}
            sub={ultimoRecibo ? `${meses[(ultimoRecibo.mes ?? 1) - 1]}` : ''}
            bgColor="bg-amber-50"
            textColor="text-amber-700"
            subColor="text-amber-400"
            small
            onClick={() => navigate('/documentos')}
          />
        </div>

        {/* ===== AVISOS ===== */}
        {unreadAvisos.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Avisos</h2>
            {unreadAvisos.slice(0, 3).map(aviso => (
              <button
                key={aviso.id}
                onClick={() => markAsRead(aviso.id)}
                className={`w-full text-left rounded-xl border shadow-sm p-3.5 transition-all active:scale-[0.99] ${
                  aviso.prioridade === 'urgente'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-lg ${
                    aviso.prioridade === 'urgente' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {aviso.prioridade === 'urgente' ? <AlertTriangle size={14} /> : <Megaphone size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate">{aviso.titulo}</p>
                      {aviso.prioridade === 'urgente' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase shrink-0">Urgente</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{aviso.mensagem}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{formatDate(aviso.data_publicacao || aviso.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
            {unreadAvisos.length > 3 && (
              <button
                onClick={() => navigate('/avisos')}
                className="w-full text-center text-xs text-orange-600 font-medium py-1.5 hover:text-orange-700"
              >
                Ver todos os avisos
              </button>
            )}
          </div>
        )}

        {/* ===== REGISTOS DE HOJE (detailed) ===== */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Registos Hoje</h2>
            {horasTrabalhadas > 0 && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {horasTrabalhadas.toFixed(1)}h
              </span>
            )}
          </div>
          {registosHoje.length === 0 ? (
            <div className="text-center py-6">
              <Clock size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-300">Sem registos hoje</p>
            </div>
          ) : (
            <div className="space-y-2">
              {registosHoje.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${r.tipo === 'entrada' ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className="text-sm text-gray-700 capitalize">{r.tipo}</span>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">{formatTime(r.hora)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== AVISO MODAL ===== */}
      {expandedAviso && (() => {
        const aviso = avisos.find(a => a.id === expandedAviso);
        if (!aviso) return null;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setExpandedAviso(null)}>
            <div
              className={`w-full max-w-md rounded-2xl shadow-xl p-5 space-y-3 ${
                aviso.prioridade === 'urgente' ? 'bg-red-50' : 'bg-white'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    aviso.prioridade === 'urgente' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {aviso.prioridade === 'urgente' ? <AlertTriangle size={18} /> : <Megaphone size={18} />}
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{aviso.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {aviso.prioridade === 'urgente' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">Urgente</span>
                      )}
                      <span className="text-[11px] text-gray-400">{formatDate(aviso.data_publicacao || aviso.created_at)}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setExpandedAviso(null)} className="p-1 rounded-full hover:bg-gray-200 text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <div className={`rounded-xl p-4 ${aviso.prioridade === 'urgente' ? 'bg-white/80' : 'bg-gray-50'}`}>
                <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{aviso.mensagem}</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function MiniCard({ label, value, sub, bgColor, textColor, subColor, progress, progressColor, small, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`${bgColor} rounded-2xl p-3.5 text-left active:scale-[0.97] transition-all`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${subColor}`}>{label}</p>
      <p className={`${small ? 'text-base' : 'text-xl'} font-bold ${textColor} mt-0.5`}>{value}</p>
      {progress !== undefined ? (
        <div className="w-full bg-white/60 rounded-full h-1.5 mt-1.5">
          <div className={`${progressColor} h-1.5 rounded-full transition-all`} style={{ width: `${progress}%` }} />
        </div>
      ) : (
        <p className={`text-[10px] ${subColor} mt-0.5`}>{sub}</p>
      )}
    </button>
  );
}
