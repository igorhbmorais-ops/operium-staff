import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDeviceId, getDeviceLabel } from '@/lib/deviceId';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [colaborador, setColaborador] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState('checking'); // 'checking' | 'ok' | 'mismatch' | 'first'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Refresh token inválido ou expirado — limpar sessão
        console.warn('Sessão inválida:', error.message);
        handleSessionExpired();
        return;
      }
      if (session?.user) {
        setUser(session.user);
        fetchColaborador(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
        fetchColaborador(session.user.id);
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setColaborador(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        fetchColaborador(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleSessionExpired() {
    // Limpar tudo — força redirect para login
    localStorage.removeItem('sb-qoqvbxocoyhyjehictpc-auth-token');
    setUser(null);
    setColaborador(null);
    setLoading(false);
  }

  async function fetchColaborador(authUserId) {
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('id, nome, email, categoria, user_id, empresa_id, permissoes, cargo_id, device_id, device_nome, device_vinculado_em')
        .eq('auth_user_id', authUserId)
        .single();

      if (error || !data) {
        console.error('Colaborador não encontrado para auth_user_id:', authUserId);
        setColaborador(null);
        setDeviceStatus('ok');
      } else {
        // Buscar cargo para determinar nível e permissões hierárquicas
        if (data.cargo_id) {
          const { data: cargo } = await supabase
            .from('cargos')
            .select('id, nome, nivel, permissoes')
            .eq('id', data.cargo_id)
            .single();
          data.cargo = cargo || null;
        }
        setColaborador(data);

        // Verificar device binding
        await checkDeviceBinding(data);
      }
    } catch (err) {
      console.error('Erro ao buscar colaborador:', err);
      setDeviceStatus('ok');
    } finally {
      setLoading(false);
    }
  }

  async function checkDeviceBinding(colab) {
    try {
      const currentDeviceId = await getDeviceId();

      if (!colab.device_id) {
        // Primeiro login — vincular automaticamente
        const deviceNome = getDeviceLabel();
        await supabase
          .from('colaboradores')
          .update({
            device_id: currentDeviceId,
            device_nome: deviceNome,
            device_vinculado_em: new Date().toISOString(),
          })
          .eq('id', colab.id);
        setDeviceStatus('ok');
      } else if (colab.device_id === currentDeviceId) {
        setDeviceStatus('ok');
      } else {
        setDeviceStatus('mismatch');
      }
    } catch (err) {
      console.error('Erro ao verificar device:', err);
      setDeviceStatus('ok'); // fail-open
    }
  }

  function setDeviceOk() {
    setDeviceStatus('ok');
    // Re-fetch para actualizar dados do colaborador
    if (user?.id) fetchColaborador(user.id);
  }

  async function refreshColaborador() {
    if (!user?.id) return;
    await fetchColaborador(user.id);
  }

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem('sb-qoqvbxocoyhyjehictpc-auth-token');
    setUser(null);
    setColaborador(null);
  }

  return (
    <AuthContext.Provider value={{ user, colaborador, loading, logout, refreshColaborador, deviceStatus, setDeviceOk }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
