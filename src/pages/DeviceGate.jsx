// DeviceGate.jsx — Ecrã de verificação quando dispositivo não é reconhecido
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getDeviceId, getDeviceLabel } from '@/lib/deviceId';
import { Smartphone, Shield, Loader2, AlertTriangle, Lock } from 'lucide-react';

const MAX_TENTATIVAS = 3;
const BLOQUEIO_MINUTOS = 30;
const BLOQUEIO_KEY = 'device_gate_bloqueio';

export default function DeviceGate({ colaboradorId, onSuccess, onLogout }) {
  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [tentativas, setTentativas] = useState(0);
  const [bloqueado, setBloqueado] = useState(() => {
    const ts = localStorage.getItem(BLOQUEIO_KEY);
    if (!ts) return false;
    const diff = Date.now() - parseInt(ts, 10);
    return diff < BLOQUEIO_MINUTOS * 60 * 1000;
  });
  const inputsRef = useRef([]);

  function handleInput(index, value) {
    if (!/^\d*$/.test(value)) return;
    const novo = [...codigo];
    novo[index] = value.slice(-1);
    setCodigo(novo);

    // Auto-avançar
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !codigo[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setCodigo(text.split(''));
      inputsRef.current[5]?.focus();
    }
  }

  async function handleValidar() {
    const codigoStr = codigo.join('');
    if (codigoStr.length !== 6) {
      setErro('Introduza o código de 6 dígitos.');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      const deviceId = await getDeviceId();
      const deviceNome = getDeviceLabel();

      // Buscar chave válida
      const { data: chave, error } = await supabase
        .from('device_access_keys')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .eq('codigo', codigoStr)
        .eq('usado', false)
        .gte('expira_em', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!chave) {
        const novasTentativas = tentativas + 1;
        setTentativas(novasTentativas);

        if (novasTentativas >= MAX_TENTATIVAS) {
          localStorage.setItem(BLOQUEIO_KEY, String(Date.now()));
          setBloqueado(true);
          setErro(`Demasiadas tentativas. Bloqueado por ${BLOQUEIO_MINUTOS} minutos.`);
        } else {
          setErro(`Código inválido ou expirado. Tentativa ${novasTentativas}/${MAX_TENTATIVAS}.`);
        }
        setCodigo(['', '', '', '', '', '']);
        inputsRef.current[0]?.focus();
        return;
      }

      // Marcar chave como usada
      await supabase
        .from('device_access_keys')
        .update({ usado: true })
        .eq('id', chave.id);

      // Vincular novo dispositivo
      await supabase
        .from('colaboradores')
        .update({
          device_id: deviceId,
          device_nome: deviceNome,
          device_vinculado_em: new Date().toISOString(),
        })
        .eq('id', colaboradorId);

      // Limpar bloqueio
      localStorage.removeItem(BLOQUEIO_KEY);
      onSuccess();
    } catch (err) {
      console.error('Erro ao validar código:', err);
      setErro('Erro ao validar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // Verificar se bloqueio expirou
  if (bloqueado) {
    const ts = parseInt(localStorage.getItem(BLOQUEIO_KEY) || '0', 10);
    if (Date.now() - ts >= BLOQUEIO_MINUTOS * 60 * 1000) {
      localStorage.removeItem(BLOQUEIO_KEY);
      setBloqueado(false);
      setTentativas(0);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #0a0e27 0%, #111633 40%, #0f172a 100%)' }}>

      <div className="w-full max-w-md rounded-2xl p-8"
           style={{
             background: 'rgba(30, 41, 59, 0.7)',
             backdropFilter: 'blur(20px)',
             border: '1px solid rgba(148, 163, 184, 0.1)',
             boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
           }}>

        {/* Icone */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl mb-4 shadow-lg shadow-orange-500/20">
            <Smartphone size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Dispositivo nao reconhecido</h1>
          <p className="text-sm text-gray-400 mt-2">
            Este dispositivo nao esta autorizado para a sua conta.
            Solicite um codigo de acesso ao seu gestor.
          </p>
        </div>

        {bloqueado ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <Lock size={20} className="text-red-400" />
              <p className="text-red-400 text-sm font-medium">
                Bloqueado por {BLOQUEIO_MINUTOS} minutos
              </p>
            </div>
            <p className="text-gray-500 text-xs">
              Demasiadas tentativas falhadas. Aguarde ou contacte o seu gestor.
            </p>
            <button
              onClick={onLogout}
              className="text-sm text-red-400 hover:text-red-300 underline transition-colors"
            >
              Terminar sessao
            </button>
          </div>
        ) : (
          <>
            {/* Input de 6 dígitos */}
            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {codigo.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputsRef.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleInput(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-mono font-bold bg-slate-800/50 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              ))}
            </div>

            {erro && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {erro}
              </div>
            )}

            <button
              onClick={handleValidar}
              disabled={loading || codigo.join('').length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold py-3 rounded-lg text-sm transition-colors duration-200"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Shield size={18} />
              )}
              {loading ? 'A validar...' : 'Validar codigo'}
            </button>

            <button
              onClick={onLogout}
              className="w-full mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Terminar sessao
            </button>
          </>
        )}
      </div>

      <p className="text-center text-xs text-gray-600 mt-6">
        Operium · staff.operium.pt
      </p>
    </div>
  );
}
