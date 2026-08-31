import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, type DocumentData } from 'firebase/firestore';

export interface BroadcastConfig {
  activo: boolean;
  active?: boolean;
  mensaje: string;
  message?: string;
  tipo: 'info' | 'warning' | 'critical' | 'alerta';
  type?: 'info' | 'warning' | 'critical' | 'alerta';
  fecha?: string;
  updatedAt?: any;
  updatedBy?: string;
}

const DEFAULT_BROADCAST: BroadcastConfig = {
  activo: false,
  active: false,
  mensaje: '',
  message: '',
  tipo: 'info',
  type: 'info',
};

export function useBroadcastBanner() {
  const [broadcast, setBroadcast] = useState<BroadcastConfig>(DEFAULT_BROADCAST);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to doc 'config/broadcast'
    const unsub = onSnapshot(
      doc(db, 'config', 'broadcast'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as DocumentData;
          const isActivo = Boolean(data.activo ?? data.active ?? false);
          const msg = data.mensaje || data.message || '';
          const tp = data.tipo || data.type || 'info';
          setBroadcast({
            activo: isActivo,
            active: isActivo,
            mensaje: msg,
            message: msg,
            tipo: tp,
            type: tp,
            fecha: data.fecha || '',
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          });
        } else {
          setBroadcast(DEFAULT_BROADCAST);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error escuchando broadcast banner:', error);
        setBroadcast(DEFAULT_BROADCAST);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const updateBroadcast = async (
    data: Partial<BroadcastConfig> & { usuarioEmail?: string }
  ) => {
    const isActivo = data.activo ?? data.active ?? false;
    const msg = data.mensaje ?? data.message ?? '';
    const tp = data.tipo ?? data.type ?? 'info';

    const payload = {
      activo: isActivo,
      active: isActivo,
      mensaje: msg,
      message: msg,
      tipo: tp,
      type: tp,
      fecha: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      updatedBy: data.usuarioEmail || 'admin',
    };

    // Update both paths for full compatibility
    await setDoc(doc(db, 'config', 'broadcast'), payload, { merge: true });
    try {
      await setDoc(doc(db, 'configuracion', 'anuncioGlobal'), payload, { merge: true });
    } catch {
      // ignore if configuracion collection rules differ
    }
  };

  const clearBroadcast = async (usuarioEmail?: string) => {
    await updateBroadcast({
      activo: false,
      active: false,
      mensaje: '',
      message: '',
      tipo: 'info',
      usuarioEmail,
    });
  };

  return { broadcast, loading, updateBroadcast, clearBroadcast };
}
