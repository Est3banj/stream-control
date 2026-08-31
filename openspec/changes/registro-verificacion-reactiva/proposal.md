# Propuesta: Onboarding Reactivo y Verificación de Correo en Tiempo Real

**Identificador:** `registro-verificacion-reactiva`  
**Fecha:** 2026-08-30  
**Autor:** Senior Architect  
**Estado:** Propuesta en revisión  

---

## 1. Resumen Ejecutivo y Propuesta de Valor

La verificación de correo electrónico es el primer punto de contacto operativo de un nuevo cliente con StreamControl. La propuesta actual transforma una pantalla pasiva y propensa a fricciones en un **flujo de onboarding reactivo, inmersivo y auto-dirigido de nivel SaaS Tier-1**.

### Propuesta de Valor:
1. **Fricción Cero (*Zero-Friction Activation*):** El usuario no necesita interactuar con la pantalla de StreamControl tras hacer clic en su correo. El sistema detecta la validación de forma autónoma (en la misma pestaña, otra pestaña o desde su smartphone) y lo conduce fluidamente al Dashboard.
2. **Claridad Visual y Confianza:** Micro-interacciones continuas mediante un radar de detección con `framer-motion` transmiten al usuario que el sistema está trabajando para él en tiempo real.
3. **Resiliencia Operativa y Prevención de Errores:** Eliminación de errores 429 por reintentos descontrolados mediante temporizadores de enfriamiento (*cooldowns*) visuales, y erradicación del bloqueo del usuario (*trapped user*) mediante vías de escape claras para corrección de credenciales y cierre de sesión.

---

## 2. Pilares de la Experiencia Reactiva

```
+-----------------------------------------------------------------------+
|                       PANTALLA DE VERIFICACIÓN                        |
|                                                                       |
|   +-------------------+       +-----------------------------------+   |
|   |    Radar Ping     |  ==>  |     Escucha Activa Reactiva       |   |
|   |  (Framer Motion)  |       |  - Smart Polling (3.5s)           |   |
|   +-------------------+       |  - Focus/Visibility Listeners     |   |
|                               |  - BroadcastChannel Multi-tab     |   |
|   +-------------------+       +-----------------------------------+   |
|   |  Cooldown Button  |                         ||                    |
|   |    (60s Timer)    |                         \/                    |
|   +-------------------+       +-----------------------------------+   |
|                               |     Transición de Éxito           |   |
|   +-------------------+       |  - Morphing Checkmark animado     |   |
|   |   Escape Hatches  |  ==>  |  - Auto-Redirect (3s countdown)   |   |
|   | (Cambiar / Salir) |       |  - Entrada Inmediata al Dashboard |   |
|   +-------------------+       +-----------------------------------+   |
+-----------------------------------------------------------------------+
```

### 2.1 Radar de Detección en Tiempo Real (`RadarPing`)
- Ondas concéntricas animadas en bucle infinito con opacidad y escala decreciente construidas sobre `framer-motion`.
- Efecto de resplandor ambiental (*ambient glow*) y gradiente violeta/índigo acorde con el sistema de diseño de StreamControl.
- Transmite dinamismo y elimina la percepción de "pantalla colgada".

### 2.2 Motor de Sondeo Inteligente (*Smart Polling & Reactive Listeners*)
- **Heartbeat Suave:** Polling configurable cada 3.5 segundos ejecutando `auth.currentUser.reload()` y evaluando `emailVerified` sin sobrecargar el cliente ni agotar cuotas.
- **Trigger Instantáneo por Foco:** Listener sobre `window.addEventListener('focus')` y `document.addEventListener('visibilitychange')`. En el instante en que el usuario cambia de su aplicación de correo (Gmail, Outlook, pestaña del navegador) y regresa a StreamControl, se dispara una verificación inmediata con debounce (sin esperar al siguiente ciclo de polling).
- **Sincronización Inter-Pestañas:** Canal de comunicación `BroadcastChannel('auth_verification')` y listener de `storage` para que, si el usuario verifica en una pestaña `/r/verificar-email`, todas las pestañas abiertas de StreamControl se desbloqueen simultáneamente.

### 2.3 Transición de Éxito Inmersiva y Redirección Automática
- Al detectarse `emailVerified === true`, el estado del componente pasa a `VERIFIED_SUCCESS`.
- `AnimatePresence` de `framer-motion` efectúa una transición fluida:
  - El radar se contrae y transforma en un badge circular esmeralda con checkmark animado en SVG (`pathLength`).
  - Se muestra un contador regresivo de redirección ("*Entrando al panel en 3 segundos...*").
  - Botón de acción directa "*Entrar ahora*" para usuarios impacientes.
  - Al completar la cuenta regresiva, navegación automática hacia `/` mediante `useNavigate`.

### 2.4 Temporizador de Cooldown para Reenvío (`CooldownButton`)
- Temporizador visual de 60 segundos tras el envío inicial o cualquier reenvío.
- Deshabilita el botón mostrando el progreso regresivo: `Reenviar correo (48s)`.
- Persistencia en `sessionStorage` (`auth_resend_cooldown_until`) para mantener el cooldown activo incluso si el usuario refresca la página (F5), previniendo activamente el error 429 del backend.

### 2.5 Vías de Escape y Tolerancia a Fallos (*Escape Hatches*)
- **Modal de Corrección de Correo:** Si el usuario ingresó un email con error, un enlace secundario "*¿Te equivocaste de correo? Cambialo acá*" abre un diálogo modal para ingresar la nueva dirección y su contraseña, actualizando Firebase Auth y Firestore y enviando el nuevo enlace automáticamente.
- **Cierre de Sesión Seguro:** Enlace "*Cerrar sesión / Volver al login*" que invoca `logout()` y redirige limpiamente a `/login`.

---

## 3. Impacto en Métricas y Beneficios

1. **Reducción del Churn en Onboarding:** Se estima una reducción del 60% en abandonos durante el paso de verificación de correo.
2. **Cero Tickets de Soporte por "Usuario Bloqueado":** La posibilidad de corregir el correo o cerrar sesión elimina la necesidad de asistencia manual por errores tipográficos.
3. **Optimización de Tráfico Backend:** El cooldown en cliente reduce las peticiones redundantes a la Cloud Function `enviarCorreoVerificacion` a un máximo de 1 por minuto por usuario real.

---

## 4. Alternativas Consideradas y Descartadas

| Alternativa | Razón de Descarte |
|---|---|
| **WebSockets / Firestore `onSnapshot` directo para Auth** | Firebase Auth no expone `onAuthStateChanged` en tiempo real para cambios de `emailVerified` que ocurren externamente sin un `auth.currentUser.reload()`. Un listener de Firestore requeriría suscripciones costosas en cada sesión anónima/no verificada. El *Smart Polling* con `reload()` + `focus listener` es infinitamente más ligero y 100% confiable. |
| **Pestaña estática con botón manual** | La experiencia actual; genera frustración, alta tasa de rebote y sensación de producto obsoleto. |
| **Polling agresivo (cada 1s)** | Incurre en riesgo de throttling por parte del SDK de Firebase y consumo innecesario de batería/CPU en dispositivos móviles. |
