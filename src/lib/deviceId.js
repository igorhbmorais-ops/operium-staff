// deviceId.js — Gestão de ID persistente do dispositivo via IndexedDB
// O UUID sobrevive a limpar cache/localStorage (IndexedDB é mais persistente)

const DB_NAME = 'operium_staff_device';
const STORE_NAME = 'device';
const KEY = 'device_id';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateUUID() {
  // crypto.randomUUID() disponível em contextos seguros
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Obter o device ID persistente. Cria um novo UUID se não existir.
 */
export async function getDeviceId() {
  try {
    const db = await openDB();
    const existing = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (existing) {
      db.close();
      return existing;
    }

    // Gerar novo UUID e guardar
    const newId = generateUUID();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(newId, KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    db.close();
    return newId;
  } catch (err) {
    console.warn('IndexedDB indisponível, fallback para localStorage:', err);
    // Fallback: localStorage
    let id = localStorage.getItem('operium_device_id');
    if (!id) {
      id = generateUUID();
      localStorage.setItem('operium_device_id', id);
    }
    return id;
  }
}

/**
 * Obter label legível do dispositivo.
 */
export function getDeviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const match = ua.match(/Android[^;]*;\s*([^)]+)\)/);
    return match ? match[1].trim() : 'Android';
  }
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Dispositivo desconhecido';
}
