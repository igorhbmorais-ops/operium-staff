import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurity } from '@/contexts/SecurityContext';
import { definirPin } from '@/lib/security';
import { Shield, Loader2 } from 'lucide-react';

export default function PinSetup() {
  const { colaborador } = useAuth();
  const { setPinDefinido, setPinVerificado } = useSecurity();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1); // 1 = definir, 2 = confirmar
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleDigit(digit) {
    if (step === 1) {
      if (pin.length < 4) setPin(prev => prev + digit);
    } else {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + digit);
    }
    setError('');
  }

  function handleDelete() {
    if (step === 1) {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  }

  // Auto-advance quando PIN completo
  if (step === 1 && pin.length === 4 && confirmPin.length === 0) {
    setTimeout(() => setStep(2), 300);
  }

  async function handleConfirm() {
    if (confirmPin.length !== 4) return;

    if (pin !== confirmPin) {
      setError('Os PINs não coincidem');
      setConfirmPin('');
      setStep(1);
      setPin('');
      return;
    }

    setLoading(true);
    try {
      await definirPin(colaborador.id, pin);
      setPinDefinido();
      setPinVerificado();
    } catch (err) {
      setError(err.message);
      setConfirmPin('');
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit quando confirmação completa
  if (step === 2 && confirmPin.length === 4 && !loading) {
    setTimeout(() => handleConfirm(), 300);
  }

  const currentPin = step === 1 ? pin : confirmPin;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-6">
      <div className="w-full max-w-xs text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-6">
          <Shield size={32} className="text-white" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {step === 1 ? 'Definir PIN' : 'Confirmar PIN'}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {step === 1
            ? 'Escolha um PIN de 4 dígitos para segurança'
            : 'Insira o PIN novamente para confirmar'
          }
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Dots */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all ${
                i < currentPin.length ? 'bg-blue-600 scale-110' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {loading ? (
          <Loader2 size={32} className="animate-spin text-blue-500 mx-auto" />
        ) : (
          /* Numpad */
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
      </div>
    </div>
  );
}
