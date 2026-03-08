import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import Ponto from '@/pages/Ponto';
import Ferias from '@/pages/Ferias';
import Recibos from '@/pages/Recibos';
import Perfil from '@/pages/Perfil';
import Notificacoes from '@/pages/Notificacoes';
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { user, colaborador, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (!colaborador) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-semibold text-gray-700">Conta sem acesso ao Staff</p>
        <p className="text-sm text-gray-400 mt-2">
          A sua conta não está associada a nenhum colaborador.
          Contacte o seu empregador.
        </p>
        <button
          onClick={async () => {
            const { supabase } = await import('@/lib/supabase');
            supabase.auth.signOut();
          }}
          className="mt-6 text-sm text-red-500 underline"
        >
          Terminar sessão
        </button>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ponto" element={<Ponto />} />
        <Route path="/ferias" element={<Ferias />} />
        <Route path="/recibos" element={<Recibos />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
