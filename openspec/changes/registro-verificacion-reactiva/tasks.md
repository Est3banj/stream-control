# Tareas: Onboarding Reactivo y Verificación de Correo en Tiempo Real

**Identificador:** `registro-verificacion-reactiva`  
**Estado:** Pendiente (Fase SDD: Planificación completada)  

---

## Fase 1: Tipos y Hook Reactivo de Observación

- [ ] **1.1** Definir interfaces y tipos TypeScript para la verificación reactiva en `src/types/authVerification.ts`.
  - *Commit:* `feat(auth): add typescript definitions for reactive email verification`
- [ ] **1.2** Implementar el hook personalizado `src/hooks/useEmailVerificationWatcher.ts` con Smart Polling (3.5s), listeners de visibilidad/foco (`window.focus`, `visibilitychange`), sincronización con `BroadcastChannel` y prevención de memory leaks.
  - *Commit:* `feat(auth): create useEmailVerificationWatcher hook with smart polling and focus listeners`

---

## Fase 2: Componentes UI y Micro-interacciones con Framer Motion

- [ ] **2.1** Crear el componente animado `src/components/Auth/RadarPing.tsx` con ondas concéntricas pulsantes, gradientes de resplandor y soporte para `framer-motion`.
  - *Commit:* `feat(auth): create RadarPing component with framer-motion pulses`
- [ ] **2.2** Crear el componente `src/components/Auth/CooldownButton.tsx` con temporizador regresivo visual de 60 segundos, persistencia en `sessionStorage` y protección anti-spam.
  - *Commit:* `feat(auth): create CooldownButton with persistent countdown timer`
- [ ] **2.3** Crear el componente `src/components/Auth/SuccessCelebration.tsx` con animación de checkmark SVG trazado, contador regresivo de redirección (3s) y botón de acceso inmediato al Dashboard.
  - *Commit:* `feat(auth): create SuccessCelebration component with animated checkmark and auto-redirect`

---

## Fase 3: Vías de Escape y Resiliencia

- [ ] **3.1** Crear el modal `src/components/Auth/CambiarEmailModal.tsx` para permitir al usuario corregir errores tipográficos en su correo sin quedar atrapado, actualizando Firebase Auth y Firestore y reenviando el enlace.
  - *Commit:* `feat(auth): create CambiarEmailModal for in-place email correction`

---

## Fase 4: Orquestación e Integración en `VerificarEmail.tsx`

- [ ] **4.1** Refactorizar integralmente `src/components/Auth/VerificarEmail.tsx` para orquestar la máquina de estados, integrando el watcher reactivo, radar, cooldown, modal de cambio de correo, botón de cierre de sesión y pantalla de celebración.
  - *Commit:* `refactor(auth): overhaul VerificarEmail with reactive watcher and rich feedback`
- [ ] **4.2** Asegurar la compatibilidad de navegación y manejo de errores en `src/components/Auth/Login.tsx` y `src/contexts/AuthContext.tsx`.
  - *Commit:* `fix(auth): smooth navigation and error handling in login and auth context`

---

## Fase 5: Pruebas Unitarias, Integración y Calidad

- [ ] **5.1** Crear suite de pruebas para `useEmailVerificationWatcher.test.ts` validando el intervalo de sondeo, eventos de foco y limpieza de listeners.
  - *Commit:* `test(auth): add unit tests for useEmailVerificationWatcher`
- [ ] **5.2** Crear suite de pruebas para `VerificarEmail.test.tsx` cubriendo estados de espera, reenvío con cooldown, corrección de email y redirección exitosa.
  - *Commit:* `test(auth): add component tests for VerificarEmail flow`
- [ ] **5.3** Ejecutar validación de tipos (`npm run typecheck`) y suite completa de tests (`npm test`).
  - *Commit:* `chore(auth): verify types and test suite for reactive email verification`
