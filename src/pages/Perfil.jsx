import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  User, LogOut, Lock,
  Eye, EyeOff, Check, X, Loader2, Shield, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

function AlterarPassword() {
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showActual, setShowActual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const requisitos = [
    { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
    { label: '1 maiúscula', test: (p) => /[A-Z]/.test(p) },
    { label: '1 minúscula', test: (p) => /[a-z]/.test(p) },
    { label: '1 número', test: (p) => /[0-9]/.test(p) },
    { label: '1 especial', test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

  const allRequisitos = requisitos.every(r => r.test(nova));
  const passwordsMatch = nova === confirmar && confirmar.length > 0;
  const canSubmit = actual.length > 0 && allRequisitos && passwordsMatch && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: actual,
      });

      if (signInError) {
        setFeedback({ type: 'error', msg: 'Password actual incorrecta' });
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: nova });
      if (updateError) throw updateError;

      setFeedback({ type: 'success', msg: 'Password alterada com sucesso' });
      setActual('');
      setNova('');
      setConfirmar('');
      setTimeout(() => setOpen(false), 2000);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Erro ao alterar password' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Segurança</h2>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Alterar Password</p>
          {feedback && (
            <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              feedback.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {feedback.type === 'success' ? <Check size={14} /> : <X size={14} />}
              {feedback.msg}
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password actual</label>
            <div className="relative">
              <input type={showActual ? 'text' : 'password'} value={actual} onChange={e => setActual(e.target.value)} required
                className="w-full px-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all" />
              <button type="button" onClick={() => setShowActual(!showActual)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showActual ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nova password</label>
            <div className="relative">
              <input type={showNova ? 'text' : 'password'} value={nova} onChange={e => setNova(e.target.value)} required
                className="w-full px-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all" />
              <button type="button" onClick={() => setShowNova(!showNova)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNova ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {nova.length > 0 && (
            <div className="grid grid-cols-2 gap-1">
              {requisitos.map((req, i) => {
                const passed = req.test(nova);
                return (
                  <div key={i} className="flex items-center gap-1">
                    {passed ? <Check size={12} className="text-green-500" /> : <X size={12} className="text-red-400" />}
                    <span className={`text-[11px] ${passed ? 'text-green-600' : 'text-gray-400'}`}>{req.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirmar nova password</label>
            <div className="relative">
              <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all" />
            </div>
            {confirmar.length > 0 && !passwordsMatch && (
              <p className="text-[11px] text-red-500 mt-1">As passwords não coincidem</p>
            )}
          </div>
          <button type="submit" disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            Alterar Password
          </button>
        </form>
      )}
    </div>
  );
}

export default function Perfil() {
  const { colaborador, user, logout } = useAuth();
  return (
    <div className="p-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Perfil</h1>

      {/* Dados pessoais */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={28} className="text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{colaborador?.nome ?? '—'}</p>
            <p className="text-sm text-gray-500">{colaborador?.categoria ?? '—'}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-700">{colaborador?.email ?? user?.email ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Segurança — Alterar Password */}
      <AlterarPassword />

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-medium py-3 rounded-xl hover:bg-red-100 transition-colors"
      >
        <LogOut size={18} /> Terminar Sessão
      </button>
    </div>
  );
}
