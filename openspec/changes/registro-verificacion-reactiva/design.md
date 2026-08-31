# Diseño Técnico: Onboarding Reactivo y Verificación de Correo en Tiempo Real

**Identificador:** `registro-verificacion-reactiva`  
**Fecha:** 2026-08-30  
**Autor:** Senior Architect  
**Estado:** Diseño aprobado  

---

## 1. Arquitectura de Componentes y Modularización

Para garantizar alta cohesión, bajo acoplamiento y facilidad de testing, el módulo de verificación de correo se estructura en componentes especializados:

```
src/
├── components/
│   └── Auth/
│       ├── VerificarEmail.tsx          # Componente Orquestador Principal
│       ├── RadarPing.tsx                # Animación de Radar con Framer Motion
│       ├── CooldownButton.tsx           # Botón con Temporizador Regresivo Persistido
│       ├── CambiarEmailModal.tsx        # Modal de Corrección de Correo
│       └── SuccessCelebration.tsx       # Card de Éxito y Cuenta Regresiva de Entrada
├── hooks/
│   └── useEmailVerificationWatcher.ts  # Hook Reactivo (Polling + Focus + BroadcastChannel)
└── types/
    └── authVerification.ts             # Definiciones de Tipos TypeScript
```

---

## 2. Tipos e Interfaces TypeScript (`src/types/authVerification.ts`)

```typescript
export type VerificationStep = 
  | 'AWAITING'           // Esperando validación (radar activo + polling)
  | 'CHECKING_MANUAL'    // Usuario presionó "Comprobar ahora"
  | 'SUCCESS'            // Verificado exitosamente (celebración + redirect)
  | 'EDITING_EMAIL';     // Modal de cambio de correo abierto

export interface CooldownState {
  remainingSeconds: number;
  isActive: boolean;
}

export interface SyncMessage {
  type: 'EMAIL_VERIFIED';
  uid: string;
  timestamp: number;
}
```

---

## 3. Hook Personalizado: `useEmailVerificationWatcher`

Este hook encapsula toda la lógica reactiva de sondeo, listeners del navegador y sincronización inter-pestañas.

```typescript
// src/hooks/useEmailVerificationWatcher.ts
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface WatcherOptions {
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
  const isCheckingRef = useRef(false);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const checkStatus = useCallback(async () => {
    if (isCheckingRef.current || !enabled) return;
    try {
      isCheckingRef.current = true;
      const isVerified = await refreshUser();
      if (isVerified) {
        // Emitir mensaje por BroadcastChannel para sincronizar otras pestañas
        try {
          const channel = new BroadcastChannel('streamcontrol_auth_sync');
          channel.postMessage({
            type: 'EMAIL_VERIFIED',
            uid: user?.uid,
            timestamp: Date.now(),
          });
          channel.close();
        } catch {
          // BroadcastChannel no soportado o error silencioso
        }
        onVerifiedRef.current();
      }
    } catch {
      // Errores de red ignorados silenciosamente durante el sondeo
    } finally {
      isCheckingRef.current = false;
    }
  }, [refreshUser, enabled, user?.uid]);

  useEffect(() => {
    if (!enabled) return;

    // 1. Sondeo periódico suave (Heartbeat)
    const intervalId = setInterval(checkStatus, pollingIntervalMs);

    // 2. Trigger reactivo al volver a la ventana / pestaña (Focus & Visibility)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleActivity = () => {
      if (document.visibilityState === 'visible') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(checkStatus, 300);
      }
    };

    window.addEventListener('focus', handleActivity);
    document.addEventListener('visibilitychange', handleActivity);
    window.addEventListener('online', handleActivity);

    // 3. Listener de BroadcastChannel para sincronización entre pestañas
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('streamcontrol_auth_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'EMAIL_VERIFIED') {
          checkStatus();
        }
      };
    } catch {
      // Ignorar si no está soportado
    }

    return () => {
      clearInterval(intervalId);
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('visibilitychange', handleActivity);
      window.removeEventListener('online', handleActivity);
      if (channel) channel.close();
    };
  }, [checkStatus, enabled, pollingIntervalMs]);

  return { checkStatus };
}
```

---

## 4. Componentes y Variantes de Animación con Framer Motion

### 4.1 Componente `RadarPing.tsx`
Renderiza 3 anillos pulsantes con desfase temporal creando el efecto de "radar activo":

```typescript
// Variantes de animación
export const ringVariants = {
  initial: { scale: 0.8, opacity: 0.8 },
  animate: (custom: number) => ({
    scale: [0.8, 2.2],
    opacity: [0.8, 0],
    transition: {
      duration: 2.4,
      repeat: Infinity,
      ease: 'easeOut',
      delay: custom * 0.7,
    },
  }),
};
```

### 4.2 Componente `SuccessCelebration.tsx`
Contiene la animación de morphing con trazado de checkmark SVG:

```typescript
// Variantes del Checkmark SVG
export const pathVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: 'easeInOut',
      delay: 0.2,
    },
  },
};
```

### 4.3 Componente `CooldownButton.tsx`
- Gestiona el tiempo restante calculando `Math.ceil((cooldownUntil - Date.now()) / 1000)`.
- Persiste `sc_email_cooldown_until` en `sessionStorage`.
- Ejecuta `setInterval` de 1 segundo para decremento en tiempo real.

### 4.4 Componente `CambiarEmailModal.tsx`
- Diálogo accesible con backdrop blur, campos `Nuevo Correo` y `Contraseña Actual`.
- Valida formato de email y longitud de clave antes de invocar `updateUserEmail`.
- Al completarse con éxito, dispara el reenvío automático y actualiza el cooldown.

---

## 5. Prevención de Race Conditions y Fugas de Memoria

1. **Debounce en Eventos de Foco:** Se implementa un debounce de 300 ms en `handleActivity` para evitar disparar múltiples llamadas simultáneas si el usuario alterna rápidamente entre pestañas.
2. **Flag de Ejecución Activa (`isCheckingRef`):** Si una llamada a `refreshUser()` está en curso, se bloquean ejecuciones concurrentes hasta que la promesa concluya.
3. **Limpieza Rigurosa en Unmount:** Todos los timers (`setInterval`, `setTimeout`), listeners globales del DOM y canales de `BroadcastChannel` se cierran explícitamente en el retorno de `useEffect`.
4. **Desconexión tras Éxito:** Una vez que `isVerified === true`, el watcher se desactiva inmediatamente (`enabled: step === 'AWAITING'`), deteniendo todo sondeo durante la pantalla de celebración.
