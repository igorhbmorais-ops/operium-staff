import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurity } from '@/contexts/SecurityContext';
import { verificarPin } from '@/lib/security';
import { Lock, Loader2 } from 'lucide-react';

export default function PinVerify() {
  const { colaborador, logout } = useAuth();
  const { setPinVerificado } = useSecurity();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tentativas, setTentativas] = useState(0);

  function handleDigit(digit) {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
      setError('');
    }
  }

  function handleDelete() {
    setPin(prev => prev.slice(0, -1));
  }

  async function handleSubmit() {
    if (pin.length !== 4) return;
    setLoading(true);

    try {
      const ok = await verificarPin(colaborador.id, pin);
      if (ok) {
        setPinVerificado();
      } else {
        setTentativas(prev => prev + 1);
        setError('PIN incorrecto');
        setPin('');
        if (tentativas >= 4) {
          setError('Demasiadas tentativas. Sessão terminada.');
          setTimeout(() => logout(), 2000);
        }
      }
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit quando PIN completo
  if (pin.length === 4 && !loading) {
    setTimeout(() => handleSubmit(), 200);
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-6">
      <div className="w-full max-w-xs text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-6">
          <Lock size={32} className="text-white" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Insira o PIN</h1>
        <p className="text-sm text-gray-500 mb-8">
          PIN de 4 dígitos para aceder ao portal
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg animate-shake">
            {error}
          </div>
        )}

        {/* Dots */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all ${
                i < pin.length ? 'bg-blue-600 scale-110' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {loading ? (
          <Loader2 size={32} className="animate-spin text-blue-500 mx-auto" />
        ) : (
          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, i) => (
              <button
                key={i}
                onClick={() => {
                  if (key === 'del') handleDelete();
                  else if (key !== null) handleDigit(String(key));
                }}
                disabled={key === null}
                className={`h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                  key === null
                    ? 'invisible'
                    : key === 'del'
                    ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {key === 'del' ? '⌫' : key}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={logout}
          className="mt-8 text-sm text-gray-400 hover:text-gray-600"
        >
          Terminar sessão
        </button>
      </div>
    </div>
  );
}
