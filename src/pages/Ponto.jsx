import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Clock, MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatTime } from '@/lib/utils';

export default function Ponto() {
  const { colaborador } = useAuth();
  const [registos, setRegistos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const hoje = new Date().toISOString().slice(0, 10);

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

  function obterLocalizacao() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não disponível'));
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
          reject(new Error('Não foi possível obter localização.'));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

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

  async function registarPonto() {
    setLoading(true);
    setFeedback(null);

    try {
      let loc = location;
      if (!loc) loc = await obterLocalizacao();

      const agora = new Date();
      const { error } = await supabase.from('ponto_registos').insert({
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
      });

      if (error) throw error;
      setFeedback({ type: 'success', msg: proximoTipo === 'entrada' ? 'Entrada registada!' : 'Saída registada!' });
      await fetchRegistos();
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  let estadoLabel = 'Sem registos hoje';
  let estadoColor = 'text-gray-400';
  if (emTurno && ultimoRegisto?.hora) {
    estadoLabel = `Em turno desde ${formatTime(ultimoRegisto.hora)}`;
    estadoColor = 'text-green-600';
  } else if (registos.length > 0) {
    estadoLabel = `Turno concluído · ${horasTrabalhadas.toFixed(1)}h`;
    estadoColor = 'text-gray-600';
  }

  return (
    <div className="p-4 pb-24 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ponto</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="flex flex-col items-center py-6">
        <p className={`text-sm font-medium mb-4 ${estadoColor}`}>{estadoLabel}</p>
        <button
          onClick={registarPonto}
          disabled={loading || geoLoading}
          className={`w-36 h-36 rounded-full flex flex-col items-center justify-center text-white font-bold text-base shadow-xl transition-all active:scale-95 ${
            proximoTipo === 'entrada'
              ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30'
              : 'bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30'
          } disabled:opacity-50`}
        >
          {loading || geoLoading ? (
            <Loader2 size={36} className="animate-spin" />
          ) : (
            <>
              <Clock size={36} />
              <span className="mt-1.5 text-sm">{proximoTipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
            </>
          )}
        </button>
        {geoLoading && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <MapPin size={12} /> A obter localização...
          </p>
        )}
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
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
          <p className="text-sm text-gray-300">Sem registos</p>
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
    </div>
  );
}
