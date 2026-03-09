// SecurityContext — Gate de segurança após login
// Verifica: dispositivo vinculado + PIN definido
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  verificarDispositivo,
  registarDispositivo,
  verificarPinExiste,
  obterConfigPonto,
} from '@/lib/security';

const SecurityContext = createContext(null);

export function SecurityProvider({ children }) {
  const { colaborador } = useAuth();
  const [securityState, setSecurityState] = useState({
    checked: false,
    deviceOk: false,
    pinDefinido: false,
    pinVerificado: false,
    config: null,
  });

  useEffect(() => {
    if (!colaborador?.id) return;
    checkSecurity();
  }, [colaborador?.id]);

  async function checkSecurity() {
    try {
      // Buscar config do dono (user_id do colaborador)
      const config = await obterConfigPonto(colaborador.user_id);

      // Verificar dispositivo
      let deviceOk = true;
      if (config.exigir_device_binding) {
        deviceOk = await verificarDispositivo(colaborador.id);
        if (!deviceOk) {
          // Primeiro acesso — registar dispositivo automaticamente
          await registarDispositivo(colaborador.id);
          deviceOk = true;
        }
      }

      // Verificar se PIN está definido
      let pinDefinido = false;
      if (config.exigir_pin) {
        pinDefinido = await verificarPinExiste(colaborador.id);
      }

      setSecurityState({
        checked: true,
        deviceOk,
        pinDefinido,
        pinVerificado: !config.exigir_pin, // se não exige PIN, já está "verificado"
        config,
      });
    } catch (err) {
      console.error('Erro security check:', err);
      // Em caso de erro, permitir acesso (fail-open para não bloquear)
      setSecurityState({
        checked: true,
        deviceOk: true,
        pinDefinido: false,
        pinVerificado: true,
        config: null,
      });
    }
  }

  function setPinVerificado() {
    setSecurityState(prev => ({ ...prev, pinVerificado: true }));
  }

  function setPinDefinido() {
    setSecurityState(prev => ({ ...prev, pinDefinido: true }));
  }

  return (
    <SecurityContext.Provider value={{ ...securityState, setPinVerificado, setPinDefinido }}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity deve ser usado dentro de SecurityProvider');
  return ctx;
}
