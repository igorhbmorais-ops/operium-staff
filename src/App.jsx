import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SecurityProvider, useSecurity } from '@/contexts/SecurityContext';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import SetupPassword from '@/pages/SetupPassword';
import PinSetup from '@/pages/PinSetup';
import PinVerify from '@/pages/PinVerify';
import Home from '@/pages/Home';
import Ponto from '@/pages/Ponto';
import Ferias from '@/pages/Ferias';
import Recibos from '@/pages/Recibos';
import Documentos from '@/pages/Documentos';
import MenuPage from '@/pages/MenuPage';
import Perfil from '@/pages/Perfil';
import Notificacoes from '@/pages/Notificacoes';
import Horario from '@/pages/Horario';
import Despesas from '@/pages/Despesas';
import Mensagens from '@/pages/Mensagens';
import Denuncia from '@/pages/Denuncia';
import Regulamento from '@/pages/Regulamento';
import Avisos from '@/pages/Avisos';
import { ToastProvider } from '@/contexts/ToastContext';
import { Loader2 } from 'lucide-react';

function SecuredRoutes() {
  const { checked, config, pinDefinido, pinVerificado } = useSecurity();

  if (!checked) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // Se exige PIN e ainda não está definido → ecrã de setup
  if (config?.exigir_pin && !pinDefinido) {
    return <PinSetup />;
  }

  // Se exige PIN e ainda não foi verificado nesta sessão → ecrã de verificação
  if (config?.exigir_pin && !pinVerificado) {
    return <PinVerify />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ponto" element={<Ponto />} />
        <Route path="/ferias" element={<Ferias />} />
        <Route path="/recibos" element={<Recibos />} />
        <Route path="/documentos" element={<Documentos />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
        <Route path="/horario" element={<Horario />} />
        <Route path="/despesas" element={<Despesas />} />
        <Route path="/mensagens" element={<Mensagens />} />
        <Route path="/denuncia" element={<Denuncia />} />
        <Route path="/regulamento" element={<Regulamento />} />
        <Route path="/avisos" element={<Avisos />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

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
        <Route path="/setup-password" element={<SetupPassword />} />
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

  // Colaborador autenticado → gate de segurança
  return (
    <SecurityProvider>
      <SecuredRoutes />
    </SecurityProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
