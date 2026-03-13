import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurity } from '@/contexts/SecurityContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { getDeviceFingerprint } from '@/lib/security';
import {
  Clock, MapPin, Loader2, CheckCircle2, AlertCircle, Camera,
  Calendar, TrendingUp, AlertTriangle, TimerOff, ChevronLeft,
  ChevronRight, Send, X, FileEdit, Eye
} from 'lucide-react';
import { formatTime, formatDate } from '@/lib/utils';

/* ─── Selfie Capture ─── */
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
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button onClick={capturar} className="flex-1 py-2.5 text-sm text-white bg-blue-600 rounded-lg flex items-center justify-center gap-1">
            <Camera size={16} /> Capturar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Correction Request Modal ─── */
function CorrecaoModal({ registo, onClose, onSubmitted, colaboradorId, empresaId }) {
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!descricao.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('ponto_correccoes').insert({
      empresa_id: empresaId,
      registo_ponto_id: registo.id,
      colaborador_id: colaboradorId,
      descricao: descricao.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast('Erro ao enviar pedido', 'error');
    } else {
      toast('Pedido de correccao enviado', 'success');
      onSubmitted();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Pedir correccao</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="text-xs text-gray-500">
            Registo: {registo.tipo} - {formatTime(registo.hora)} ({formatDate(registo.data)})
          </div>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descreva o que esta incorrecto..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            required
          />
          <button
            type="submit"
            disabled={submitting || !descricao.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
            Enviar pedido
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Helper: week boundaries ─── */
function getWeekRange(offset = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Monday-based week
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function getMonthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function parseTimeStr(timeStr) {
  if (!timeStr) return null;
  const d = new Date(timeStr);
  return { hours: d.getHours(), minutes: d.getMinutes(), total: d.getHours() * 60 + d.getMinutes() };
}

/* ─── Status helpers ─── */
const STATUS = {
  onTime:   { icon: '✅', label: 'No horario', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  late:     { icon: '⚠️', label: 'Atraso', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  absent:   { icon: '🔴', label: 'Falta', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  dayOff:   { icon: '🔵', label: 'Folga', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
  vacation: { icon: '🟣', label: 'Ferias', color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
  inProgress:{ icon: '⏱', label: 'Em curso', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
};

function computeDayStatus(dayRegs, turno, isToday) {
  if (!dayRegs || dayRegs.length === 0) {
    return STATUS.absent;
  }
  const entrada = dayRegs.find(r => r.tipo === 'entrada');
  const saida = dayRegs.find(r => r.tipo === 'saida');

  if (entrada && !saida) {
    return STATUS.inProgress;
  }

  if (entrada && turno) {
    const entradaTime = parseTimeStr(entrada.hora);
    // turno.hora_entrada is TIME like '09:00:00'
    const [tH, tM] = (turno.hora_entrada || '09:00').split(':').map(Number);
    const turnoStart = tH * 60 + tM;
    if (entradaTime && entradaTime.total > turnoStart + 5) {
      return STATUS.late;
    }
  }

  return STATUS.onTime;
}

/* ─── Shift Rules helpers ─── */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function getMinutesNow() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatTimeFromMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Evaluate entry rules based on shift and config.
 * Returns { allowed, message, type, horaEfectivaEntrada }
 * type: 'early_window' | 'on_time' | 'late' | 'too_early' | 'no_shift'
 */
function evaluateEntryRules(turno, pontoConfig) {
  if (!turno) return { allowed: true, message: null, type: 'no_shift', horaEfectivaEntrada: null };

  const agora = getMinutesNow();
  const inicioTurno = parseTimeToMinutes(turno.hora_entrada);
  if (inicioTurno === null) return { allowed: true, message: null, type: 'no_shift', horaEfectivaEntrada: null };

  const janela = pontoConfig?.janela_entrada_min ?? 15;
  const tolerancia = pontoConfig?.tolerancia_atraso_min ?? 5;
  const horaFormatada = formatTimeFromMinutes(inicioTurno);

  const diffAntes = inicioTurno - agora; // positive = before shift start

  if (diffAntes > janela) {
    // Too early
    return {
      allowed: false,
      message: `O seu turno comeca as ${horaFormatada}`,
      type: 'too_early',
      horaEfectivaEntrada: null,
    };
  }

  if (diffAntes > 0 && diffAntes <= janela) {
    // Early window: button active, effective entry = shift start
    return {
      allowed: true,
      message: `Ponto registado! O seu horario comeca as ${horaFormatada}`,
      type: 'early_window',
      horaEfectivaEntrada: inicioTurno,
    };
  }

  const diffDepois = agora - inicioTurno; // positive = after shift start

  if (diffDepois >= 0 && diffDepois <= tolerancia) {
    // On time
    return {
      allowed: true,
      message: null,
      type: 'on_time',
      horaEfectivaEntrada: null,
    };
  }

  // Late
  return {
    allowed: true,
    message: `Atraso de ${diffDepois} minutos`,
    type: 'late',
    horaEfectivaEntrada: null,
  };
}

/**
 * Evaluate exit rules based on shift and config.
 * Returns { message, saidaAntecipada, tempoAlemPontoMin, horaEfectivaSaida }
 */
function evaluateExitRules(turno, pontoConfig) {
  if (!turno) return { message: null, saidaAntecipada: false, tempoAlemPontoMin: 0, horaEfectivaSaida: null };

  const agora = getMinutesNow();
  const fimTurno = parseTimeToMinutes(turno.hora_saida);
  if (fimTurno === null) return { message: null, saidaAntecipada: false, tempoAlemPontoMin: 0, horaEfectivaSaida: null };

  const horaFormatada = formatTimeFromMinutes(fimTurno);
  const diff = agora - fimTurno; // positive = after shift end

  if (diff < -5) {
    // Before shift end (more than 5 min early)
    return {
      message: `Saida antecipada. O seu horario termina as ${horaFormatada}.`,
      saidaAntecipada: true,
      tempoAlemPontoMin: 0,
      horaEfectivaSaida: null,
    };
  }

  if (diff >= -5 && diff <= 5) {
    // Normal exit (within ±5 min of shift end)
    return {
      message: `O seu horario de trabalho terminou as ${horaFormatada}. Bom descanso!`,
      saidaAntecipada: false,
      tempoAlemPontoMin: 0,
      horaEfectivaSaida: fimTurno,
    };
  }

  // After shift end — overtime
  return {
    message: `O seu horario de trabalho terminou as ${horaFormatada}. Bom descanso!`,
    saidaAntecipada: false,
    tempoAlemPontoMin: diff,
    horaEfectivaSaida: fimTurno,
  };
}

/* ─── Main Component ─── */
export default function Ponto() {
  const { colaborador } = useAuth();
  const { config } = useSecurity();
  const toast = useToast();

  // Punch state
  const [registos, setRegistos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState(null);

  // Shift rules state
  const [turnoHoje, setTurnoHoje] = useState(null);
  const [pontoConfigEmpresa, setPontoConfigEmpresa] = useState(null);
  const [entryEval, setEntryEval] = useState(null);
  const [clockTick, setClockTick] = useState(0);

  // Tabs: hoje | semana | mes
  const [tab, setTab] = useState('hoje');

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekRecords, setWeekRecords] = useState([]);
  const [weekTurno, setWeekTurno] = useState(null);
  const [weekFolgas, setWeekFolgas] = useState(new Set());
  const [weekFerias, setWeekFerias] = useState(new Set());
  const [weekCorreccoes, setWeekCorreccoes] = useState({});

  // Month navigation
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [monthRecords, setMonthRecords] = useState([]);

  // Correction modal
  const [correcaoRegisto, setCorrecaoRegisto] = useState(null);

  // Day detail (from calendar click)
  const [selectedDay, setSelectedDay] = useState(null);

  const hoje = new Date().toISOString().slice(0, 10);

  /* ── Fetch today's shift and ponto config ── */
  useEffect(() => {
    if (!colaborador?.id || !colaborador?.empresa_id) return;
    fetchShiftAndConfig();
  }, [colaborador?.id, colaborador?.empresa_id]);

  async function fetchShiftAndConfig() {
    try {
      // Get today's day of week (1=Mon, 7=Sun)
      const jsDow = new Date().getDay();
      const diaSemana = jsDow === 0 ? 7 : jsDow;

      // Get assigned shift for today
      const { data: atribs } = await supabase
        .from('escala_atribuicoes')
        .select('turno_id, dia_semana, turnos(hora_entrada, hora_saida)')
        .eq('colaborador_id', colaborador.id)
        .eq('dia_semana', diaSemana)
        .limit(1);

      if (atribs?.length && atribs[0]?.turnos) {
        setTurnoHoje(atribs[0].turnos);
      } else {
        // Fallback: try any assigned shift
        const { data: anyAtrib } = await supabase
          .from('escala_atribuicoes')
          .select('turno_id, turnos(hora_entrada, hora_saida)')
          .eq('colaborador_id', colaborador.id)
          .limit(1);
        if (anyAtrib?.length && anyAtrib[0]?.turnos) {
          setTurnoHoje(anyAtrib[0].turnos);
        }
      }

      // Get ponto_config_empresa
      const { data: pontoConf } = await supabase
        .from('ponto_config_empresa')
        .select('*')
        .eq('empresa_id', colaborador.empresa_id)
        .maybeSingle();
      if (pontoConf) setPontoConfigEmpresa(pontoConf);
    } catch (e) {
      console.error('Erro ao carregar turno/config:', e);
    }
  }

  // Re-evaluate entry rules every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setClockTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (turnoHoje) {
      setEntryEval(evaluateEntryRules(turnoHoje, pontoConfigEmpresa));
    }
  }, [turnoHoje, pontoConfigEmpresa, clockTick]);

  /* ── Fetch today's records ── */
  useEffect(() => {
    if (!colaborador?.id) return;
    fetchRegistos();
  }, [colaborador?.id]);

  async function fetchRegistos() {
    const { data } = await supabase
      .from('ponto_registos')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .eq('data', hoje)
      .order('hora', { ascending: true });
    setRegistos(data ?? []);
  }

  /* ── Fetch week data ── */
  useEffect(() => {
    if (!colaborador?.id) return;
    fetchWeekData();
  }, [colaborador?.id, weekOffset]);

  async function fetchWeekData() {
    const { start, end } = getWeekRange(weekOffset);
    const startStr = toDateStr(start);
    const endStr = toDateStr(end);

    // Registos
    const { data: regs } = await supabase
      .from('ponto_registos')
      .select('*')
      .eq('colaborador_id', colaborador.id)
      .gte('data', startStr)
      .lte('data', endStr)
      .order('data', { ascending: true })
      .order('hora', { ascending: true });
    setWeekRecords(regs ?? []);

    // Turno do colaborador (via escala_atribuicoes → turnos)
    const { data: atrib } = await supabase
      .from('escala_atribuicoes')
      .select('turno_id, dia_semana, turnos(hora_entrada, hora_saida)')
      .eq('colaborador_id', colaborador.id)
      .limit(7);

    if (atrib?.length && atrib[0]?.turnos) {
      setWeekTurno(atrib[0].turnos);
    } else {
      // Fallback: ponto_config default hours
      setWeekTurno({ hora_entrada: '09:00', hora_saida: '18:00' });
    }

    // Folgas (escala_folgas)
    const { data: folgas } = await supabase
      .from('escala_folgas')
      .select('dia_semana')
      .eq('colaborador_id', colaborador.id);
    setWeekFolgas(new Set((folgas ?? []).map(f => f.dia_semana)));

    // Ferias aprovadas no periodo
    const { data: ferias } = await supabase
      .from('pedidos_ferias')
      .select('data_inicio, data_fim')
      .eq('colaborador_id', colaborador.id)
      .eq('estado', 'aprovado')
      .lte('data_inicio', endStr)
      .gte('data_fim', startStr);

    const feriasDays = new Set();
    (ferias ?? []).forEach(f => {
      let d = new Date(f.data_inicio);
      const fim = new Date(f.data_fim);
      while (d <= fim) {
        const ds = toDateStr(d);
        if (ds >= startStr && ds <= endStr) feriasDays.add(ds);
        d.setDate(d.getDate() + 1);
      }
    });
    setWeekFerias(feriasDays);

    // Correccoes for these records
    const regIds = (regs ?? []).map(r => r.id);
    if (regIds.length > 0) {
      const { data: corrs } = await supabase
        .from('ponto_correccoes')
        .select('*')
        .in('registo_ponto_id', regIds);
      const map = {};
      (corrs ?? []).forEach(c => { map[c.registo_ponto_id] = c; });
      setWeekCorreccoes(map);
    } else {
      setWeekCorreccoes({});
    }
  }

  /* ── Fetch month data ── */
  useEffect(() => {
    if (!colaborador?.id || tab !== 'mes') return;
    fetchMonthData();
  }, [colaborador?.id, tab, monthDate.year, monthDate.month]);

  async function fetchMonthData() {
    const { start, end } = getMonthRange(monthDate.year, monthDate.month);
    const { data } = await supabase
      .from('ponto_registos')
      .select('id, data, tipo, hora')
      .eq('colaborador_id', colaborador.id)
      .gte('data', toDateStr(start))
      .lte('data', toDateStr(end))
      .order('data', { ascending: true })
      .order('hora', { ascending: true });
    setMonthRecords(data ?? []);
  }

  /* ── Geolocation ── */
  function obterLocalizacao() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalizacao nao disponivel'));
        return;
      }
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(loc);
          setGeoLoading(false);
          resolve(loc);
        },
        () => {
          setGeoLoading(false);
          reject(new Error('Nao foi possivel obter localizacao.'));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  /* ── Punch logic ── */
  const ultimoRegisto = registos[registos.length - 1];
  const proximoTipo = !ultimoRegisto || ultimoRegisto.tipo === 'saida' ? 'entrada' : 'saida';
  const emTurno = ultimoRegisto?.tipo === 'entrada';

  let horasTrabalhadas = 0;
  for (let i = 0; i < registos.length - 1; i += 2) {
    if (registos[i]?.hora && registos[i + 1]?.hora) {
      horasTrabalhadas += (new Date(registos[i + 1].hora) - new Date(registos[i].hora)) / 3600000;
    }
  }
  if (emTurno && ultimoRegisto?.hora) {
    horasTrabalhadas += (Date.now() - new Date(ultimoRegisto.hora).getTime()) / 3600000;
  }

  async function uploadSelfie(blob) {
    const filename = `${colaborador.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('selfies')
      .upload(filename, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error('Erro ao guardar selfie');
    const { data: urlData } = supabase.storage.from('selfies').getPublicUrl(filename);
    return urlData.publicUrl;
  }

  async function registarPonto(selfieBlob = null) {
    setLoading(true);
    setFeedback(null);

    try {
      // ── Apply entry/exit rules ──
      if (proximoTipo === 'entrada' && entryEval && !entryEval.allowed) {
        setFeedback({ type: 'info', msg: entryEval.message });
        setLoading(false);
        return;
      }

      let loc = location;
      if (!loc) loc = await obterLocalizacao();

      let selfieFinalUrl = null;
      if (selfieBlob) {
        selfieFinalUrl = await uploadSelfie(selfieBlob);
        setSelfieUrl(selfieFinalUrl);
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

      // ── Entry rules: set effective times ──
      if (proximoTipo === 'entrada') {
        insertData.hora_pique_entrada = agora.toISOString();
        if (entryEval?.type === 'early_window' && entryEval.horaEfectivaEntrada != null) {
          // Effective entry = shift start time
          const efDate = new Date(agora);
          efDate.setHours(Math.floor(entryEval.horaEfectivaEntrada / 60), entryEval.horaEfectivaEntrada % 60, 0, 0);
          insertData.hora_efectiva_entrada = efDate.toISOString();
        } else {
          insertData.hora_efectiva_entrada = agora.toISOString();
        }
      }

      // ── Exit rules: set effective times + overtime ──
      if (proximoTipo === 'saida') {
        const exitEval = evaluateExitRules(turnoHoje, pontoConfigEmpresa);
        insertData.hora_pique_saida = agora.toISOString();

        if (exitEval.horaEfectivaSaida != null) {
          const efDate = new Date(agora);
          efDate.setHours(Math.floor(exitEval.horaEfectivaSaida / 60), exitEval.horaEfectivaSaida % 60, 0, 0);
          insertData.hora_efectiva_saida = efDate.toISOString();
        } else {
          insertData.hora_efectiva_saida = agora.toISOString();
        }

        if (exitEval.saidaAntecipada) {
          insertData.saida_antecipada = true;
        }
        if (exitEval.tempoAlemPontoMin > 0) {
          insertData.tempo_alem_ponto_min = exitEval.tempoAlemPontoMin;
        }

        // Store exit message to show after punch
        if (exitEval.message) {
          setTimeout(() => {
            setFeedback({ type: 'info', msg: exitEval.message });
          }, 100);
        }
      }

      if (selfieFinalUrl) {
        insertData.selfie_url = selfieFinalUrl;
      }

      const { error } = await supabase.from('ponto_registos').insert(insertData);

      if (error) throw error;

      // ── Show entry feedback with rule context ──
      if (proximoTipo === 'entrada') {
        if (entryEval?.type === 'early_window' && entryEval.message) {
          toast(entryEval.message, 'success');
          setFeedback({ type: 'success', msg: entryEval.message });
        } else if (entryEval?.type === 'late' && entryEval.message) {
          toast(`Entrada registada. ${entryEval.message}`, 'warning');
          setFeedback({ type: 'warning', msg: `Entrada registada. ${entryEval.message}` });
        } else {
          toast('Entrada registada!', 'success');
          setFeedback({ type: 'success', msg: 'Entrada registada!' });
        }
      } else {
        toast('Saida registada!', 'success');
        // feedback set above in exit rules block
        if (!feedback) {
          setFeedback({ type: 'success', msg: 'Saida registada!' });
        }
      }

      await fetchRegistos();
      // refresh week if on semana tab
      if (tab === 'semana' && weekOffset === 0) fetchWeekData();
    } catch (err) {
      toast(err.message, 'error');
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handlePontoClick() {
    if (config?.exigir_selfie) {
      setShowCamera(true);
    } else {
      registarPonto();
    }
  }

  /* ── Computed: week grouped by day ── */
  const weekDays = useMemo(() => {
    const { start } = getWeekRange(weekOffset);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = toDateStr(d);
      const dayRegs = weekRecords.filter(r => r.data === dateStr);
      const entrada = dayRegs.find(r => r.tipo === 'entrada');
      const saida = dayRegs.find(r => r.tipo === 'saida');

      let horas = 0;
      if (entrada?.hora && saida?.hora) {
        horas = (new Date(saida.hora) - new Date(entrada.hora)) / 3600000;
      } else if (entrada?.hora && !saida && dateStr === hoje) {
        horas = (Date.now() - new Date(entrada.hora).getTime()) / 3600000;
      }

      const jsSemana = d.getDay(); // 0=Sun
      const isVacation = weekFerias.has(dateStr);
      const isDayOff = weekFolgas.has(jsSemana) || jsSemana === 0;

      let status;
      if (isVacation) status = STATUS.vacation;
      else if (isDayOff) status = STATUS.dayOff;
      else status = computeDayStatus(dayRegs, weekTurno, dateStr === hoje);

      // late minutes
      let lateMins = 0;
      if (status === STATUS.late && entrada && weekTurno) {
        const et = parseTimeStr(entrada.hora);
        const [tH, tM] = (weekTurno.hora_entrada || '09:00').split(':').map(Number);
        if (et) lateMins = et.total - (tH * 60 + tM);
      }

      days.push({ date: d, dateStr, regs: dayRegs, entrada, saida, horas, status, lateMins });
    }
    return days;
  }, [weekRecords, weekOffset, weekTurno, weekFolgas, weekFerias, hoje]);

  /* ── Computed: week summary ── */
  const weekSummary = useMemo(() => {
    const workDays = weekDays.filter(d => d.status !== STATUS.dayOff && d.status !== STATUS.vacation);
    const totalHoras = weekDays.reduce((s, d) => s + d.horas, 0);
    const expectedHoras = workDays.length * 8;
    const atrasos = weekDays.filter(d => d.status === STATUS.late).length;
    const faltas = weekDays.filter(d => d.status === STATUS.absent && d.date <= new Date()).length;
    return { totalHoras, expectedHoras, atrasos, faltas };
  }, [weekDays]);

  /* ── Computed: month grid ── */
  const monthGrid = useMemo(() => {
    const { start, end } = getMonthRange(monthDate.year, monthDate.month);
    const daysInMonth = end.getDate();
    const firstDayOfWeek = start.getDay() || 7; // Mon=1
    const recsMap = {};
    monthRecords.forEach(r => {
      if (!recsMap[r.data]) recsMap[r.data] = [];
      recsMap[r.data].push(r);
    });

    const cells = [];
    // pad start
    for (let i = 1; i < firstDayOfWeek; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(monthDate.year, monthDate.month, day);
      const dateStr = toDateStr(d);
      const regs = recsMap[dateStr] || [];
      const hasEntry = regs.some(r => r.tipo === 'entrada');
      const hasExit = regs.some(r => r.tipo === 'saida');
      const isFuture = d > new Date();

      let statusIcon = '';
      if (isFuture) statusIcon = '';
      else if (weekFerias.has(dateStr)) statusIcon = '🟣';
      else if (d.getDay() === 0 || d.getDay() === 6) statusIcon = '🔵';
      else if (hasEntry && hasExit) statusIcon = '✅';
      else if (hasEntry && !hasExit) statusIcon = '⏱';
      else if (!hasEntry && !isFuture) statusIcon = '🔴';

      cells.push({ day, dateStr, statusIcon, regs, date: d });
    }
    return cells;
  }, [monthRecords, monthDate, weekFerias]);

  /* ── UI helpers ── */
  let estadoLabel = 'Sem registos hoje';
  let estadoColor = 'text-gray-400';
  if (emTurno && ultimoRegisto?.hora) {
    estadoLabel = `Em turno desde ${formatTime(ultimoRegisto.hora)}`;
    estadoColor = 'text-green-600';
  } else if (registos.length > 0) {
    estadoLabel = `Turno concluido · ${horasTrabalhadas.toFixed(1)}h`;
    estadoColor = 'text-gray-600';
  }

  const weekLabel = (() => {
    const { start, end } = getWeekRange(weekOffset);
    const opts = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('pt-PT', opts)} - ${end.toLocaleDateString('pt-PT', opts)}`;
  })();

  const monthLabel = new Date(monthDate.year, monthDate.month).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  function progressPercent(current, total) {
    if (!total) return 0;
    return Math.min(100, Math.round((current / total) * 100));
  }

  function formatHM(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }

  function correccaoBadge(registoId) {
    const c = weekCorreccoes[registoId];
    if (!c) return null;
    if (c.estado === 'pendente') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200">Correccao pedida</span>;
    if (c.estado === 'aprovado') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">Corrigido</span>;
    if (c.estado === 'rejeitado') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">Rejeitado</span>;
    return null;
  }

  return (
    <div className="p-4 pb-24 space-y-5">
      {showCamera && (
        <SelfieCapture onCapture={blob => { setShowCamera(false); registarPonto(blob); }} onCancel={() => setShowCamera(false)} />
      )}
      {correcaoRegisto && (
        <CorrecaoModal
          registo={correcaoRegisto}
          onClose={() => setCorrecaoRegisto(null)}
          onSubmitted={() => { setCorrecaoRegisto(null); fetchWeekData(); }}
          colaboradorId={colaborador.id}
          empresaId={colaborador.empresa_id}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ponto</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Punch button */}
      <div className="flex flex-col items-center py-6">
        <p className={`text-sm font-medium mb-4 ${estadoColor}`}>{estadoLabel}</p>

        {/* Shift info + entry rule message */}
        {proximoTipo === 'entrada' && entryEval?.type === 'too_early' && (
          <div className="mb-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-center">
            <p className="text-sm text-blue-700 font-medium">{entryEval.message}</p>
            <p className="text-xs text-blue-500 mt-0.5">O botao activa {pontoConfigEmpresa?.janela_entrada_min ?? 15} min antes</p>
          </div>
        )}
        {proximoTipo === 'entrada' && entryEval?.type === 'late' && (
          <div className="mb-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">{entryEval.message}</p>
          </div>
        )}

        <button
          onClick={handlePontoClick}
          disabled={loading || geoLoading || (proximoTipo === 'entrada' && entryEval?.type === 'too_early')}
          className={`w-36 h-36 rounded-full flex flex-col items-center justify-center text-white font-bold text-base shadow-xl transition-all active:scale-95 ${
            proximoTipo === 'entrada' && entryEval?.type === 'too_early'
              ? 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-gray-300/30 cursor-not-allowed'
              : proximoTipo === 'entrada'
                ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30'
                : 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30'
          } disabled:opacity-50`}
        >
          {loading || geoLoading ? (
            <Loader2 size={36} className="animate-spin" />
          ) : (
            <>
              <Clock size={36} />
              <span className="mt-1.5 text-sm">{proximoTipo === 'entrada' ? 'Entrada' : 'Saida'}</span>
            </>
          )}
        </button>
        {geoLoading && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <MapPin size={12} /> A obter localizacao...
          </p>
        )}
        {/* Turno info */}
        {turnoHoje && (
          <p className="text-xs text-gray-400 mt-3">
            Turno: {String(turnoHoje.hora_entrada).substring(0, 5)} - {String(turnoHoje.hora_saida).substring(0, 5)}
          </p>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : feedback.type === 'warning'
            ? 'bg-amber-50 border border-amber-200 text-amber-700'
            : feedback.type === 'info'
            ? 'bg-blue-50 border border-blue-200 text-blue-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> :
           feedback.type === 'warning' ? <AlertTriangle size={16} /> :
           feedback.type === 'info' ? <Clock size={16} /> :
           <AlertCircle size={16} />}
          {feedback.msg}
        </div>
      )}

      {location && (
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full">
            <MapPin size={12} /> GPS verificado
          </span>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {['hoje', 'semana', 'mes'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              tab === t ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t === 'hoje' ? 'Hoje' : t === 'semana' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>

      {/* ═══ TAB: HOJE ═══ */}
      {tab === 'hoje' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Registos de Hoje</h2>
            {horasTrabalhadas > 0 && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {horasTrabalhadas.toFixed(1)}h
              </span>
            )}
          </div>
          {registos.length === 0 ? (
            <div className="text-center py-8">
              <TimerOff size={36} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">Sem registos hoje</p>
              <p className="text-xs text-gray-300 mt-1">Registe a sua entrada no botao acima</p>
            </div>
          ) : (
            <div className="space-y-2">
              {registos.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${r.tipo === 'entrada' ? 'bg-green-500' : 'bg-orange-400'}`} />
                    <span className="text-sm font-medium text-gray-700 capitalize">{r.tipo}</span>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">{formatTime(r.hora)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: SEMANA ═══ */}
      {tab === 'semana' && (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-700">{weekLabel}</span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 0}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Weekly summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <TrendingUp size={16} className="mx-auto text-blue-500 mb-1" />
              <p className="text-sm font-bold text-gray-900">{formatHM(weekSummary.totalHoras)}</p>
              <p className="text-[10px] text-gray-400">/ {weekSummary.expectedHoras}h</p>
              <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${progressPercent(weekSummary.totalHoras, weekSummary.expectedHoras)}%` }}
                />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <AlertTriangle size={16} className="mx-auto text-amber-500 mb-1" />
              <p className="text-lg font-bold text-gray-900">{weekSummary.atrasos}</p>
              <p className="text-[10px] text-gray-400">Atrasos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <AlertCircle size={16} className="mx-auto text-red-500 mb-1" />
              <p className="text-lg font-bold text-gray-900">{weekSummary.faltas}</p>
              <p className="text-[10px] text-gray-400">Faltas</p>
            </div>
          </div>

          {/* Daily records list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {weekDays.map(day => {
              const isToday = day.dateStr === hoje;
              const dayLabel = isToday ? 'Hoje' : day.date.toLocaleDateString('pt-PT', { weekday: 'short' });
              const dayNum = `${day.date.getDate()}/${(day.date.getMonth() + 1).toString().padStart(2, '0')}`;
              const isFuture = day.date > new Date();

              return (
                <div key={day.dateStr} className={`p-3.5 ${isToday ? 'bg-blue-50/30' : ''}`}>
                  {/* Date header + status */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800 capitalize">{dayLabel}</span>
                      <span className="text-xs text-gray-400">{dayNum}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${day.status.bg} ${day.status.color} ${day.status.border} border`}>
                      {day.status.icon} {day.status.label}
                      {day.status === STATUS.late && day.lateMins > 0 ? ` ${day.lateMins} min` : ''}
                    </span>
                  </div>

                  {/* Times */}
                  {!isFuture && day.status !== STATUS.dayOff && day.status !== STATUS.vacation && (
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {day.entrada ? formatTime(day.entrada.hora) : '---'}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        {day.saida ? formatTime(day.saida.hora) : (day.status === STATUS.inProgress ? 'em curso' : '---')}
                      </span>
                      {day.horas > 0 && (
                        <span className="ml-auto text-xs font-medium text-gray-600">
                          {formatHM(day.horas)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Correction badges + link */}
                  {day.regs.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {day.regs.map(r => (
                        <span key={r.id}>{correccaoBadge(r.id)}</span>
                      ))}
                      {day.regs.some(r => !weekCorreccoes[r.id]) && (
                        <button
                          onClick={() => setCorrecaoRegisto(day.entrada || day.regs[0])}
                          className="text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                        >
                          <FileEdit size={11} /> Pedir correccao
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB: MES ═══ */}
      {tab === 'mes' && (
        <div className="space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMonthDate(m => {
                const prev = m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 };
                return prev;
              })}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-700 capitalize">{monthLabel}</span>
            <button
              onClick={() => setMonthDate(m => {
                const next = m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 };
                return next;
              })}
              disabled={monthDate.year === new Date().getFullYear() && monthDate.month >= new Date().getMonth()}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map(d => (
                <div key={d} className="text-[10px] text-center font-semibold text-gray-400 uppercase">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cell, i) => {
                if (!cell) return <div key={`empty-${i}`} />;
                const isToday = cell.dateStr === hoje;
                const isSelected = selectedDay === cell.dateStr;
                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : cell.dateStr)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all ${
                      isToday ? 'ring-2 ring-blue-400 bg-blue-50' :
                      isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>{cell.day}</span>
                    {cell.statusIcon && <span className="text-[10px] leading-none mt-0.5">{cell.statusIcon}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && (() => {
            const dayRegs = monthRecords.filter(r => r.data === selectedDay);
            const dayDate = new Date(selectedDay + 'T00:00:00');
            const entrada = dayRegs.find(r => r.tipo === 'entrada');
            const saida = dayRegs.find(r => r.tipo === 'saida');
            let horas = 0;
            if (entrada?.hora && saida?.hora) {
              horas = (new Date(saida.hora) - new Date(entrada.hora)) / 3600000;
            }

            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase">
                    {dayDate.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
                {dayRegs.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Sem registos neste dia</p>
                ) : (
                  <div className="space-y-2">
                    {dayRegs.map(r => (
                      <div key={r.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${r.tipo === 'entrada' ? 'bg-green-500' : 'bg-orange-400'}`} />
                          <span className="text-sm text-gray-700 capitalize">{r.tipo}</span>
                        </div>
                        <span className="text-sm text-gray-500">{formatTime(r.hora)}</span>
                      </div>
                    ))}
                    {horas > 0 && (
                      <div className="pt-2 border-t border-gray-100 text-right">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          Total: {formatHM(horas)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 px-1">
            {[
              { icon: '✅', label: 'Presente' },
              { icon: '⚠️', label: 'Atraso' },
              { icon: '🔴', label: 'Falta' },
              { icon: '🔵', label: 'Folga' },
              { icon: '🟣', label: 'Ferias' },
              { icon: '⏱', label: 'Em curso' },
            ].map(l => (
              <span key={l.label} className="text-[10px] text-gray-400 flex items-center gap-1">
                <span>{l.icon}</span> {l.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
