import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [colaborador, setColaborador] = useState(null);
  const [loading, setLoading] = useState(true);

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
        .select('id, nome, email, categoria, user_id, empresa_id')
        .eq('auth_user_id', authUserId)
        .single();

      if (error || !data) {
        console.error('Colaborador não encontrado para auth_user_id:', authUserId);
        setColaborador(null);
      } else {
        setColaborador(data);
      }
    } catch (err) {
      console.error('Erro ao buscar colaborador:', err);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem('sb-qoqvbxocoyhyjehictpc-auth-token');
    setUser(null);
    setColaborador(null);
  }

  return (
    <AuthContext.Provider value={{ user, colaborador, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
