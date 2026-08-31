import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface WatcherOptions {
  pollingIntervalMs?: number;
  onVerified: () => void;
  enabled?: boolean;
}

export function useEmailVerificationWatcher({
  pollingIntervalMs = 3500,
  onVerified,
  enabled = true,
}: WatcherOptions) {
  const { refreshUser, user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const isCheckingRef = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;
  const instanceIdRef = useRef(Math.random().toString(36).substring(2, 9));

  const checkStatus = useCallback(async (): Promise<boolean> => {
    // Protección estricta: sólo consultar si está habilitado y hay sesión activa válida en el contexto
    if (isCheckingRef.current || !enabled || !user?.uid) return false;

    try {
      isCheckingRef.current = true;
      setIsChecking(true);
      const isVerified = await refreshUser();
      if (isVerified) {
        // Emitir mensaje por BroadcastChannel para sincronizar otras pestañas
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('streamcontrol_auth_sync');
            channel.postMessage({
              type: 'EMAIL_VERIFIED',
              senderId: instanceIdRef.current,
              uid: user?.uid,
              timestamp: Date.now(),
            });
            channel.close();
          }
        } catch {
          // BroadcastChannel no soportado o error silencioso
        }
        onVerifiedRef.current();
        return true;
      }
      return false;
    } catch {
      // Errores de red ignorados silenciosamente durante el sondeo
      return false;
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [refreshUser, enabled, user?.uid]);

  useEffect(() => {
    // Si no está habilitado o no hay usuario autenticado, no registrar polling ni listeners
    if (!enabled || !user?.uid) return;

    // 1. Sondeo periódico suave (Heartbeat)
    const intervalId = setInterval(() => {
      void checkStatus();
    }, pollingIntervalMs);

    // 2. Trigger reactivo al volver a la ventana / pestaña (Focus & Visibility & Online)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleActivity = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!user?.uid) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void checkStatus();
      }, 300);
    };

    window.addEventListener('focus', handleActivity);
    document.addEventListener('visibilitychange', handleActivity);
    window.addEventListener('online', handleActivity);

    // 3. Listener de BroadcastChannel para sincronización entre pestañas
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('streamcontrol_auth_sync');
        channel.onmessage = (event) => {
          if (
            event.data?.type === 'EMAIL_VERIFIED' &&
            event.data?.senderId !== instanceIdRef.current
          ) {
            void checkStatus();
          }
        };
      }
    } catch {
      // Ignorar si no está soportado en el entorno
    }

    return () => {
      clearInterval(intervalId);
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('visibilitychange', handleActivity);
      window.removeEventListener('online', handleActivity);
      if (channel) {
        try {
          channel.close();
        } catch {
          // Ignorar error al cerrar
        }
      }
    };
  }, [checkStatus, enabled, pollingIntervalMs, user?.uid]);

  return { checkStatus, isChecking };
}
