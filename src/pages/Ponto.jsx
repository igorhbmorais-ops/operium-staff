import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Clock, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { formatTime, formatDate } from '@/lib/utils';

export default function Ponto() {
  const { colaborador } = useAuth();
  const [registos, setRegistos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [sucesso, setSucesso] = useState('');

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
        (err) => {
          setGeoLoading(false);
          reject(new Error('Não foi possível obter localização. Verifique as permissões.'));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  const ultimoRegisto = registos[registos.length - 1];
  const proximoTipo = !ultimoRegisto || ultimoRegisto.tipo === 'saida' ? 'entrada' : 'saida';

  async function registarPonto() {
    setLoading(true);
    setSucesso('');
    setGeoError('');

    try {
      let loc = location;
      if (!loc) {
        loc = await obterLocalizacao();
      }

      const agora = new Date();

      const { error } = await supabase.from('ponto_registos').insert({
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

      setSucesso(proximoTipo === 'entrada' ? 'Entrada registada!' : 'Saída registada!');
      await fetchRegistos();
    } catch (err) {
      setGeoError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Ponto</h1>
      <p className="text-sm text-gray-500">{formatDate(new Date())}</p>

      {/* Botão principal */}
      <div className="flex flex-col items-center py-8">
        <button
          onClick={registarPonto}
          disabled={loading || geoLoading}
          className={`w-40 h-40 rounded-full flex flex-col items-center justify-center text-white font-bold text-lg shadow-lg transition-all active:scale-95 ${
            proximoTipo === 'entrada'
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-red-500 hover:bg-red-600'
          } disabled:opacity-50`}
        >
          {loading || geoLoading ? (
            <Loader2 size={40} className="animate-spin" />
          ) : (
            <>
              <Clock size={40} />
              <span className="mt-2">{proximoTipo === 'entrada' ? 'Entrada' : 'Saída'}</span>
            </>
          )}
        </button>

        {geoLoading && (
          <p className="text-sm text-gray-500 mt-3 flex items-center gap-1">
            <MapPin size={14} /> A obter localização...
          </p>
        )}
      </div>

      {geoError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {geoError}
        </div>
      )}

      {sucesso && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg flex items-center gap-2">
          <CheckCircle2 size={16} /> {sucesso}
        </div>
      )}

      {/* Registos de hoje */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Registos de Hoje
        </h2>
        {registos.length === 0 ? (
          <p className="text-gray-400 text-sm">Sem registos</p>
        ) : (
          <div className="space-y-2">
            {registos.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${r.tipo === 'entrada' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium text-gray-700 capitalize">{r.tipo}</span>
                </div>
                <span className="text-sm text-gray-500">{formatTime(r.hora)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
