import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, ArrowRight, Loader2, Shield } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email ou password incorretos'
        : err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Introduza o seu email primeiro');
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://staff.operium.pt/setup-password',
    });
    if (resetError) {
      setError(resetError.message);
    } else {
      setError('');
      alert('Email de recuperação enviado. Verifique a sua caixa de correio.');
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #0a0e27 0%, #111633 40%, #0f172a 100%)' }}>

      <div className="w-full max-w-md rounded-2xl p-8 md:p-10"
           style={{
             background: 'rgba(30, 41, 59, 0.7)',
             backdropFilter: 'blur(20px)',
             border: '1px solid rgba(148, 163, 184, 0.1)',
             boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
           }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Operium Staff</h1>
          <p className="text-sm text-gray-400 mt-1">Portal do Colaborador</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              placeholder="seu.email@empresa.pt"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 pr-12 py-3 bg-slate-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                placeholder="A sua password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Esqueceu password */}
          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Esqueceu a password?
            </button>
          </div>

          {/* Botao Entrar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold py-3 rounded-lg text-sm transition-colors duration-200"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        {/* Info */}
        <p className="text-center text-xs text-gray-500 mt-6 leading-relaxed">
          Acesso exclusivo para colaboradores convidados.
          <br />Contacte o seu empregador se não tem acesso.
        </p>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-600 mt-6">
        Operium · staff.operium.pt
      </p>
    </div>
  );
}
