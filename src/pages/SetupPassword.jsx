import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Shield, Lock, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';

const requisitos = [
  { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { label: '1 letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { label: '1 letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: '1 número', test: (p) => /[0-9]/.test(p) },
  { label: '1 carácter especial', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getForca(password) {
  const passed = requisitos.filter(r => r.test(password)).length;
  if (passed <= 2) return { label: 'Fraca', color: 'bg-red-500', width: '33%' };
  if (passed <= 4) return { label: 'Média', color: 'bg-yellow-500', width: '66%' };
  return { label: 'Forte', color: 'bg-green-500', width: '100%' };
}

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenError, setTokenError] = useState(false);
  const [checking, setChecking] = useState(true);

  // Processar o token do email de convite (Supabase envia via hash ou query)
  useEffect(() => {
    async function processToken() {
      try {
        // Supabase Auth envia tokens via URL hash fragment ou query params
        // O supabase-js processa automaticamente o hash ao inicializar
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (session) {
          // Sessão válida — pode definir password
          setChecking(false);
          return;
        }

        // Tentar processar tokens da URL (invite/recovery)
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          // Supabase processa automaticamente, aguardar
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
              setChecking(false);
              subscription.unsubscribe();
            }
          });
          // Timeout para token expirado
          setTimeout(() => {
            setChecking(false);
            setTokenError(true);
          }, 5000);
          return;
        }

        // Verificar query params (type=invite ou type=recovery)
        const type = searchParams.get('type');
        const token = searchParams.get('token') || searchParams.get('token_hash');

        if (type && token) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: type === 'invite' ? 'invite' : 'recovery',
            token_hash: token,
          });

          if (verifyError) {
            setTokenError(true);
          }
          setChecking(false);
          return;
        }

        // Sem token nem sessão
        setTokenError(true);
        setChecking(false);
      } catch {
        setTokenError(true);
        setChecking(false);
      }
    }

    processToken();
  }, [searchParams]);

  const forca = getForca(password);
  const allRequisitos = requisitos.every(r => r.test(password));
  const passwordsMatch = password === confirm && confirm.length > 0;
  const canSubmit = allRequisitos && passwordsMatch && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      // Password definida com sucesso — redirecionar para o Home
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Erro ao definir password. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0f172a 100%)' }}>
        <Loader2 size={32} className="animate-spin text-blue-400" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4"
           style={{ background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0f172a 100%)' }}>
        <div className="w-full max-w-[400px] bg-white/95 backdrop-blur-sm rounded-2xl p-8 text-center"
             style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-4">
            <X size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link Expirado</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Este link de convite expirou ou já foi utilizado.
            <br />Contacte o seu empregador para reenviar o convite.
          </p>
        </div>
        <p className="text-center text-xs text-gray-500/60 mt-6">
          Operium · staff.operium.pt
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a3e 50%, #0f172a 100%)' }}>

      <div className="w-full max-w-[400px] bg-white/95 backdrop-blur-sm rounded-2xl p-8 md:p-10"
           style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Bem-vindo ao Operium Staff</h1>
          <p className="text-sm text-gray-500 mt-1">Defina a sua password para aceder ao portal</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nova password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nova password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
                placeholder="Defina a sua password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Barra de força */}
          {password.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Força da password</span>
                <span className="text-xs font-medium text-gray-600">{forca.label}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all duration-300 ${forca.color}`}
                     style={{ width: forca.width }} />
              </div>
            </div>
          )}

          {/* Checklist de requisitos */}
          {password.length > 0 && (
            <div className="space-y-1">
              {requisitos.map((req, i) => {
                const passed = req.test(password);
                return (
                  <div key={i} className="flex items-center gap-2">
                    {passed ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <X size={14} className="text-red-400" />
                    )}
                    <span className={`text-xs ${passed ? 'text-green-600' : 'text-gray-400'}`}>
                      {req.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirmar password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all"
                placeholder="Confirme a password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirm.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-500 mt-1">As passwords não coincidem</p>
            )}
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-blue-500/25"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Shield size={18} />
            )}
            {loading ? 'A criar...' : 'Criar Password e Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
          Acesso exclusivo para colaboradores convidados.
        </p>
      </div>

      <p className="text-center text-xs text-gray-500/60 mt-6">
        Operium · staff.operium.pt
      </p>
    </div>
  );
}
