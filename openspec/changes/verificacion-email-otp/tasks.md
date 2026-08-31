# Tareas: Verificación de Email por Código OTP de 6 Dígitos

**Identificador:** `verificacion-email-otp`  
**Estado:** Implementación completada (Listo para Fase SDD: Verify)  

---

## Fase 1: Backend - Configuración y Servicio de Email Híbrido (Resend API + Fallbacks)

- [x] **1.1** Actualizar `api/src/config.ts` agregando los métodos de lectura `RESEND_API_KEY()` y `EMAIL_FROM()`.
  - *Commit:* `feat(api-config): add resend api key and email from configuration getters`
- [x] **1.2** Refactorizar `api/src/email.ts` para implementar el despacho híbrido de correos:
  - Enviar vía Resend REST API (`POST https://api.resend.com/emails` con `fetch` nativo).
  - Fallback a transporte SMTP (`nodemailer`) si Resend no está configurado o falla.
  - Fallback a log en consola en modo desarrollo local si no hay credenciales.
  - Crear la función `buildOtpHtml` y el método exportado `sendOtpEmail(to: string, userName: string, otp: string)`.
  - *Commit:* `feat(api-email): implement hybrid email dispatcher with resend rest api and otp template`
- [x] **1.3** Corregir en `api/src/handlers.ts` el flujo del trigger post-write `onNuevoUsuario` y el envío de correos transaccionales para evitar fallos silenciosos y desacoplar el transporte.
  - *Commit:* `fix(api-handlers): improve welcome email dispatch and error handling in onNuevoUsuario`

---

## Fase 2: Backend - Endpoints de Generación y Validación de Código OTP

- [x] **2.1** Crear el módulo `api/src/otpVerification.ts` e implementar `enviarCodigoOTP`:
  - Validar correo normalizado.
  - Generar código criptográfico de 6 dígitos con `crypto.randomInt`.
  - Hashear código con SHA-256 y guardar en Firestore `otpsVerificacion/{sha256(email)}` con expiración de 10 minutos (`now + 10m`) y límite de 5 intentos.
  - Enviar email con el código OTP.
  - *Commit:* `feat(api-otp): create enviarCodigoOTP handler with sha256 hashing and firestore storage`
- [x] **2.2** Implementar en `api/src/otpVerification.ts` la función `verificarCodigoOTP`:
  - Validar existencia, TTL (10m) e intentos máximos (5).
  - Comparar hash SHA-256 del código provisto.
  - Si es incorrecto: incrementar contador de intentos o eliminar si alcanza el límite.
  - Si es correcto: actualizar Firebase Auth (`admin.auth().updateUser`), Firestore `usuarios/{uid}` con `emailVerified: true`, y eliminar el documento de OTP.
  - *Commit:* `feat(api-otp): create verificarCodigoOTP handler with attempts limit and dual auth sync`
- [x] **2.3** Registrar las nuevas rutas en `api/src/registry.ts`:
  - Agregar `enviarCodigoOTP` (`auth: 'none'`) con rate limit transaccional de 1 solicitud cada 60s por hash de email.
  - Agregar `verificarCodigoOTP` (`auth: 'none'`).
  - *Commit:* `feat(api-registry): register enviarCodigoOTP and verificarCodigoOTP in FN_REGISTRY`

---

## Fase 3: Frontend - Componente OtpInput y Contexto de Autenticación

- [x] **3.1** Actualizar `src/types/authVerification.ts` con los nuevos tipos e interfaces para el flujo OTP (`OtpState`, `VerificationStep`).
  - *Commit:* `feat(auth-types): define types and state contracts for otp verification`
- [x] **3.2** Crear el componente `src/components/Auth/OtpInput.tsx`:
  - 6 inputs individuales con auto-focus secuencial al escribir.
  - Manejo de `Backspace` para retroceder casillas vacías.
  - Navegación con flechas `ArrowLeft` / `ArrowRight`.
  - Soporte completo de pegado (`onPaste`) con sanitización de caracteres no numéricos y auto-disparo de `onComplete`.
  - Atributos móviles `inputMode="numeric"`, `pattern="[0-9]*"`, `autoComplete="one-time-code"`.
  - *Commit:* `feat(auth-ui): create accessible 6-digit OtpInput component with paste and auto-advance`
- [x] **3.3** Extender `src/contexts/AuthContext.tsx`:
  - Agregar método `enviarCodigoOTP(email?: string, nombre?: string): Promise<void>`.
  - Agregar método `verificarCodigo(codigo: string, email?: string): Promise<void>`.
  - Actualizar `register` para despachar el código OTP inicial.
  - *Commit:* `feat(auth-context): add enviarCodigoOTP and verificarCodigo methods to AuthContext`

---

## Fase 4: Frontend - Rediseño e Integración de la Vista VerificarEmail

- [x] **4.1** Refactorizar `src/components/Auth/VerificarEmail.tsx`:
  - Integrar el componente `OtpInput` como núcleo de interacción.
  - Conectar botón "Verificar código" con estado interactivo de carga.
  - Mantener `CooldownButton` para el reenvío de OTP con 60s de espera persistida en `sessionStorage`.
  - Mantener `CambiarEmailModal` para corrección de correo y reenvío automático.
  - Mantener `SuccessCelebration` con animación de checkmark y redirección automática en 3 segundos a `/`.
  - Conservar enlace de escape seguro "Cerrar sesión".
  - *Commit:* `refactor(auth-ui): overhaul VerificarEmail screen to 6-digit OTP verification flow`

---

## Fase 5: Testing, Integración y Calidad

- [x] **5.1** Crear suite de pruebas de integración para el backend en `api/tests/otpVerification.test.ts`:
  - Test de generación y guardado de OTP en Firestore.
  - Test de rate limiting (1 llamada cada 60s).
  - Test de verificación exitosa y actualización dual (Firebase Auth + Firestore).
  - Test de código incorrecto e incremento de intentos.
  - Test de superación de 5 intentos fallidos (bloqueo/invalidación).
  - Test de código expirado (> 10m).
  - *Commit:* `test(api-otp): add integration test suite for otp generation and verification handlers`
- [x] **5.2** Crear y actualizar suites de tests en frontend:
  - Crear `src/components/Auth/OtpInput.test.tsx` probando escritura, backspace, paste y disparo de `onComplete`.
  - Actualizar `src/components/Auth/VerificarEmail.test.tsx` con el flujo interactivo de OTP.
  - *Commit:* `test(auth-ui): add unit and component tests for OtpInput and VerificarEmail OTP flow`
- [x] **5.3** Ejecutar comprobación de tipos y suite completa de tests (`npm test` en backend y frontend).
  - *Commit:* `chore(auth): verify types and test suites across api and client`
