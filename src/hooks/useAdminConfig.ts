import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export interface AdminConfig {
  whatsapp: string;
}

const CONFIG_DOC = 'general';
const CONFIG_COLLECTION = 'config';

const DEFAULT_CONFIG: AdminConfig = {
  whatsapp: '',
};

export function useAdminConfig() {
  const [config, setConfig] = useState<AdminConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, CONFIG_COLLECTION, CONFIG_DOC),
      (snap) => {
        if (snap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...snap.data() } as AdminConfig);
        } else {
          setConfig(DEFAULT_CONFIG);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error leyendo configuración global:', error);
        setConfig(DEFAULT_CONFIG);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { config, loading };
}

export async function updateAdminConfig(data: Partial<AdminConfig>): Promise<void> {
  await setDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC), data, { merge: true });
}

/** Extrae solo dígitos de un número de teléfono para usar en links de WhatsApp */
export function sanitizarWhatsApp(numero: string): string {
  return numero.replace(/[^0-9]/g, '');
}
