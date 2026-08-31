# Exploración: Registro y Verificación de Correo Reactiva en StreamControl

**Fecha:** 2026-08-30  
**Rama:** `feature/registro-verificacion-reactiva`  
**Autor:** Senior Architect  
**Estado:** Exploración completada  

---

## 1. Contexto y Diagnóstico del Problema

StreamControl es una plataforma SaaS de alto rendimiento donde el onboarding representa la fase más crítica del ciclo de vida del usuario. El flujo de autenticación actual exige que todo usuario registrado valide su dirección de correo electrónico antes de acceder al panel principal (a excepción de administradores o inicios de sesión federados con Google).

Actualmente, el flujo de verificación tras el registro presenta una arquitectura **pasiva, rígida y vulnerable a puntos ciegos de UX**:

1. **Verificación Pasiva:** Una vez que el usuario se registra o intenta ingresar sin verificar, aterriza en `/verificar-email`. La pantalla es completamente estática; no existe sondeo automático (*smart polling*) ni detección de retorno de foco (`window.focus` / `visibilitychange`).
2. **Dependencia de Acción Manual ("Click fatigue"):** El usuario que abre el link en su cliente de correo (en otra pestaña o desde el teléfono móvil) regresa a StreamControl y encuentra la misma pantalla fija, obligándolo a adivinar que debe presionar el botón "Ya verifiqué mi correo".
3. **Bloqueo del Usuario ("Trapped User"):** Si el usuario cometió un error tipográfico en su dirección de correo (ej. `juan@gmal.com` en lugar de `juan@gmail.com`), queda atrapado en `/verificar-email` sin posibilidad de corregir su correo, cambiar de cuenta ni cerrar sesión limpiamente.
4. **Ausencia de Cooldown Visual en Frontend:** El backend (`api/src/registry.ts`) impone un rate limit de 1 solicitud cada 60 segundos por hash de email (`windowMs: 60_000`). No obstante, en la interfaz no hay temporizador de cuenta regresiva (*countdown*), provocando que clicks repetidos disparen errores `429 (resource-exhausted)` frustrantes.
5. **Falta de Feedback Sensorial y Micro-interacciones:** No hay indicadores visuales de escucha activa (ondas de radar, animaciones fluidas con `framer-motion`) ni una transición de éxito gratificante al completarse la validación.

---

## 2. Diagnóstico Técnico de Archivos y Componentes

### 2.1 `src/components/Auth/Login.tsx`
- **Flujo de Registro (`handleRegister`):**
  - Invoca `register(...)` de `AuthContext`, el cual crea la credencial en Firebase Auth, inicializa el documento en `usuarios/{uid}`, dispara `onNuevoUsuario` y envía el correo de verificación custom mediante Cloud Function.
  - Al resolverse la promesa, ejecuta `nav('/verificar-email')` sin pasar metadatos sobre el estado de reenvío o cooldown.
- **Flujo de Login (`handleLogin`):**
  - Si las credenciales son válidas pero `!firebaseUser.emailVerified`, `AuthContext.login()` arroja `Error("Verificá tu correo antes de continuar...")`.
  - `Login.tsx` captura la excepción y redirige a `/verificar-email`.

### 2.2 `src/components/Auth/VerificarEmail.tsx`
- **Estado Local Limitado:** Solo maneja flags booleanos `enviando` y `revisando`.
- **Efecto de Redirección por URL (`?verified=true`):** Contiene un `useEffect` que detecta si el usuario llegó con el parámetro `?verified=true` desde `VerificarEmailLink.tsx`, ejecutando `refreshUser()`. Sin embargo, esto solo sirve si el enlace abrió la misma pestaña; si el usuario abrió el correo en el celular o en otra ventana, la pestaña principal no se entera nunca.
- **Sin Escape Hatch:** No existe botón de "Cerrar sesión" (`logout()`) ni opción para "Corregir correo" (`updateUserEmail`). Si el correo no existe, el usuario no puede salir de la vista sin borrar cookies/localStorage a mano.
- **Falta de Sincronización Multi-Pestaña:** No escucha `BroadcastChannel` ni eventos de storage.

### 2.3 `src/contexts/AuthContext.tsx`
- **Métodos Clave:**
  - `refreshUser()`: Ejecuta `auth.currentUser.reload()`, consulta `auth.currentUser.emailVerified` y actualiza el estado local `user`.
  - `sendVerificationEmail()`: Invoca la función backend `enviarCorreoVerificacion` pasando `{ email, nombre }`.
  - `updateUserEmail(newEmail, currentPassword)`: Permite actualizar el correo en Auth y Firestore, pero requiere contraseña actual. En la pantalla de verificación tras el registro inmediato, el usuario ya tiene la sesión activa.
- **Oportunidad Técnica:** `AuthContext` cuenta con los métodos fundamentales para soportar la reactividad, pero carece de un observador automático que sincronice el estado cuando la verificación ocurre fuera de la sesión actual.

### 2.4 `src/components/Auth/PrivateRoute.tsx`
- Intercepta todas las rutas protegidas. Si `user` existe pero `!user.emailVerified && user.rol !== 'admin'`, renderiza directamente `<VerificarEmail />`.
- Esta arquitectura asegura que ningún usuario sin verificar acceda al sistema, pero refuerza la necesidad de que `<VerificarEmail />` sea autónomo, reactivo y libre de callejones sin salida.

### 2.5 `api/src/emailVerification.ts` & `src/pages/VerificarEmailLink.tsx`
- El backend genera un token criptográfico único (`randomUUID()`), lo almacena en `tokensVerificacion` con TTL de 24 horas y actualiza tanto Firestore `usuarios/{uid}` como Firebase Auth `updateUser({ emailVerified: true })`.
- `VerificarEmailLink.tsx` es la landing pública (`/r/verificar-email?token=...`) que procesa el token y redirige a `/app/verificar-email?verified=true`.

---

## 3. Matriz de Fricciones y Soluciones de Arquitectura

| Fricción Detectada | Causa Raíz | Solución de Arquitectura Propuesta |
|---|---|---|
| **1. Verificación Pasiva** | No hay mecanismo de consulta en segundo plano ni listeners de eventos del navegador. | Implementar `useEmailVerificationWatcher` con **Smart Polling** (intervalo de 3.5s), **Focus & Visibility Listeners** (`window.focus`, `visibilitychange`) y **BroadcastChannel** inter-tabs. |
| **2. Usuario Atrapado ("Trapped User")** | Falta de controles de escape en la vista de verificación. | Integrar botón secundario **"Cerrar sesión / Salir"** y modal accesible **"¿Email incorrecto? Cambiar correo"** con validación en caliente. |
| **3. Errores 429 por Spam de Reenvío** | El rate limit de 60s en backend no se refleja en la UI del frontend. | Componente `CooldownButton` con temporizador visual regresivo persistido en `sessionStorage` (60 segundos) y estado deshabilitado reactivo. |
| **4. Falta de Feedback Sensorial** | UI estática con spinner básico de Tailwind. | Animación de radar pulsante concéntrico con `framer-motion` (Radar Ping) que denote escucha activa en tiempo real. |
| **5. Transición Brusca de Éxito** | Navegación instantánea o toasts desalineados. | Card de éxito con animación spring, checkmark animado, mensaje de bienvenida personalizado y cuenta regresiva de redirección automática (3 segundos) con botón de salto inmediato. |

---

## 4. Conclusión de la Exploración

La solución requiere transformar la pantalla de verificación de un formulario estático a un **centro de control reactivo en tiempo real**, optimizado para eliminar cualquier fricción en el onboarding del vendedor, reduciendo la tasa de abandono (*drop-off*) y garantizando una experiencia visual de nivel profesional.
