// security.js — BLOCO 4 — Anti-fraude: PIN, Device Binding, Biometria
import { supabase } from './supabase';

// ==================== DEVICE FINGERPRINT ====================

function generateFingerprint() {
  const nav = window.navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    nav.hardwareConcurrency || '',
    nav.platform || '',
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'dev_' + Math.abs(hash).toString(36);
}

export function getDeviceFingerprint() {
  return generateFingerprint();
}

export function getDeviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Dispositivo desconhecido';
}

// ==================== DEVICE BINDING ====================

export async function verificarDispositivo(colaboradorId) {
  const fingerprint = getDeviceFingerprint();

  const { data, error } = await supabase
    .from('staff_devices')
    .select('id, activo')
    .eq('colaborador_id', colaboradorId)
    .eq('device_fingerprint', fingerprint)
    .eq('activo', true)
    .maybeSingle();

  if (error) throw error;
  return !!data; // true = dispositivo conhecido
}

export async function registarDispositivo(colaboradorId) {
  const fingerprint = getDeviceFingerprint();
  const label = getDeviceLabel();

  // Verificar se já existe
  const { data: existing } = await supabase
    .from('staff_devices')
    .select('id')
    .eq('colaborador_id', colaboradorId)
    .eq('device_fingerprint', fingerprint)
    .maybeSingle();

  if (existing) {
    // Reactivar
    await supabase
      .from('staff_devices')
      .update({ activo: true, ultimo_acesso: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('staff_devices').insert({
      colaborador_id: colaboradorId,
      device_fingerprint: fingerprint,
      device_label: label,
      activo: true,
      ultimo_acesso: new Date().toISOString(),
    });
  }
}

// ==================== PIN ====================

export async function verificarPinExiste(colaboradorId) {
  const { data } = await supabase
    .from('staff_pins')
    .select('id')
    .eq('colaborador_id', colaboradorId)
    .eq('activo', true)
    .maybeSingle();

  return !!data;
}

export async function verificarPin(colaboradorId, pin) {
  // Chamar Edge Function para verificar PIN (hash no servidor)
  const { data: { session } } = await supabase.auth.getSession();

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verificar-pin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ colaboradorId, pin }),
    }
  );

  const body = await resp.json();
  if (!resp.ok) throw new Error(body.error || 'Erro ao verificar PIN');
  return body.ok;
}

export async function definirPin(colaboradorId, pin) {
  const { data: { session } } = await supabase.auth.getSession();

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/definir-pin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ colaboradorId, pin }),
    }
  );

  const body = await resp.json();
  if (!resp.ok) throw new Error(body.error || 'Erro ao definir PIN');
  return body.ok;
}

// ==================== BIOMETRIA (WebAuthn) ====================

export function biometriaDisponivel() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

export async function verificarBiometriaRegistada(colaboradorId) {
  const { data } = await supabase
    .from('staff_webauthn')
    .select('id')
    .eq('colaborador_id', colaboradorId)
    .eq('activo', true)
    .maybeSingle();

  return !!data;
}

// ==================== REGISTAR / VERIFICAR BIOMETRIA (WebAuthn) ====================

export async function registarBiometria(colaboradorId) {
  // Generate challenge
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const createOptions = {
    publicKey: {
      challenge,
      rp: { name: 'Operium Staff', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(colaboradorId),
        name: `staff-${colaboradorId.slice(0, 8)}`,
        displayName: 'Operium Staff',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  };

  const credential = await navigator.credentials.create(createOptions);

  // Store credential
  const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(credential.response.getPublicKey())));

  await supabase.from('staff_webauthn').insert({
    colaborador_id: colaboradorId,
    credential_id: credentialId,
    public_key: publicKey,
    device_name: getDeviceLabel(),
    activo: true,
  });

  return true;
}

export async function verificarBiometria(colaboradorId) {
  // Get stored credential
  const { data: creds } = await supabase
    .from('staff_webauthn')
    .select('credential_id')
    .eq('colaborador_id', colaboradorId)
    .eq('activo', true);

  if (!creds || creds.length === 0) throw new Error('Biometria não registada');

  const allowCredentials = creds.map(c => ({
    id: Uint8Array.from(atob(c.credential_id), ch => ch.charCodeAt(0)),
    type: 'public-key',
  }));

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const getOptions = {
    publicKey: {
      challenge,
      allowCredentials,
      userVerification: 'required',
      timeout: 60000,
    },
  };

  await navigator.credentials.get(getOptions);
  return true; // If we get here, biometria was verified
}

// ==================== CONFIG ====================

export async function obterConfigPonto(userId) {
  const { data } = await supabase
    .from('ponto_config')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Defaults se não existir config
  return {
    exigir_pin: data?.exigir_pin ?? false,
    exigir_device_binding: data?.exigir_device_binding ?? false,
    exigir_biometria: data?.exigir_biometria ?? false,
    exigir_selfie: data?.exigir_selfie ?? false,
    ...data,
  };
}
