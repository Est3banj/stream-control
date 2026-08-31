# Propuesta: Migración a Verificación de Email por Código OTP de 6 Dígitos (Resend API & Firebase Admin)

**Identificador:** `verificacion-email-otp`  
**Fecha:** 2026-08-31  
**Autor:** Senior Architect  
**Estado:** Propuesta aprobada para SDD  

---

## 1. Resumen Ejecutivo y Diagnóstico Arquitectónico

La verificación de identidad mediante correo electrónico es el umbral crítico de activación en StreamControl. El mecanismo previo basado en enlaces de verificación (*magic links*) presenta fricciones severas y fallos estructurales en producción:

1. **Ruptura de Sesión y Contexto (*Context Switching*):** Al pulsar un enlace en el cliente de correo (Gmail, Outlook en smartphone o webview), el usuario suele ser redirigido a un navegador externo o pestaña aislada donde no existe la sesión de autenticación activa.
2. **Intercepción y Consumo Previo por Bots (*Link Prefetching*):** Los filtros de seguridad corporativos y escáneres anti-phishing hacen peticiones automáticas `GET` o `HEAD` a los enlaces entrantes, "quemando" tokens de un solo uso antes de que el usuario humano llegue a abrirlos.
3. **Dependencia y Bloqueo de Cuotas SMTP de Gmail:** El transporte tradicional vía SMTP de Gmail adolece de problemas de reputación de IP, limitaciones de concurrencia y latencias elevadas.
4. **Fallas Silenciosas en Bienvenida:** El trigger `onNuevoUsuario` sufría bloqueos si el transporte SMTP fallaba o tardaba en responder, afectando la experiencia inicial.

### La Solución: Verificación In-App por Código OTP de 6 Dígitos
La propuesta consiste en migrar a un flujo **OTP (One-Time Password) de 6 dígitos numéricos**:
- **Experiencia In-App Fluida:** El usuario nunca abandona la pantalla de StreamControl. Abre su correo, lee el código numérico de 6 dígitos, lo ingresa (o pega) en los inputs interactivos de la aplicación y queda verificado de inmediato.
- **Resend REST API como Proveedor Primario:** Integración nativa vía `fetch` contra `https://api.resend.com/emails` para una entregabilidad > 99.8% y latencias inferiores a 500 ms, con fallback transparente a SMTP si Resend no está configurado, o mock a consola en entornos de desarrollo local.
- **Seguridad Criptográfica y Anti-Brute-Force:** Códigos generados con `crypto.randomInt`, almacenados en Firestore como hashes SHA-256 (`sha256(otp)`), con expiración estricta de 10 minutos y límite de 5 intentos fallidos antes de invalidación total.
- **Sincronización Atómica Dual:** Al validar el OTP, el backend actualiza de forma autoritativa tanto el usuario en Firebase Auth (`admin.auth().updateUser(uid, { emailVerified: true })`) como el documento del usuario en Firestore (`usuarios/{uid}` con `emailVerified: true`).

---

## 2. Arquitectura de la Solución

```
+--------------------------------------------------------------------------------------------------+
|                                    FLUJO GENERAL DE VERIFICACIÓN OTP                             |
|                                                                                                  |
|   +-------------------+      POST /api/enviarCodigoOTP      +--------------------------------+   |
|   |  Frontend UI      | ----------------------------------> | Backend API (Express)          |   |
|   |  (VerificarEmail) |                                     | - Rate Limit 1/60s (SHA-256)   |   |
|   +-------------------+                                     | - Genera OTP criptográfico     |   |
|            ^                                                | - Guarda en Firestore con Hash |   |
|            |                                                +--------------------------------+   |
|            |                                                                |                    |
|            |                                                                v                    |
|            |                                                +--------------------------------+   |
|            |                                                | Resend REST API (o SMTP)       |   |
|            |                                                | Despacho de Email HTML con OTP |   |
|            |                                                +--------------------------------+   |
|            |                                                                |                    |
|            | Ingresa / Pega OTP de 6 dígitos                                v                    |
|            |                                                +--------------------------------+   |
|            |                                                | Casilla de Correo del Usuario  |   |
|            |                                                | "Tu código es 482910"          |   |
|            |                                                +--------------------------------+   |
|            v                                                                                     |
|   +-------------------+     POST /api/verificarCodigoOTP    +--------------------------------+   |
|   |  OtpInput (6 box) | ----------------------------------> | Backend API (Express)          |   |
|   |  Auto-submit      |                                     | - Compara SHA-256(código)      |   |
|   +-------------------+                                     | - Valida TTL (10m) e Intentos  |   |
|            |                                                | - Firebase Admin: set Verified |   |
|            v                                                | - Firestore: update doc & rm   |   |
|   +-------------------+                                     +--------------------------------+   |
|   | Celebración Éxito | <---------------------------------------------------|                    |
|   | -> Redirección /  |                 { success: true }                                        |
|   +-------------------+                                                                          |
+--------------------------------------------------------------------------------------------------+
```

---

## 3. Pilares de la Experiencia y Componentes

### 2.1 Backend: Motor Híbrido de Email (`api/src/email.ts`)
- Despacho REST directo vía `fetch` a `https://api.resend.com/emails` usando `RESEND_API_KEY`.
- Fallback automático a `nodemailer` (SMTP) si `RESEND_API_KEY` no está configurado pero sí `SMTP_USER`/`SMTP_PASS`.
- Fallback a impresión formateada en consola (*mock*) si ninguno está presente en desarrollo local.
- Template HTML responsive, con branding de StreamControl y dígitos en formato destacado (`letter-spacing: 8px; font-size: 36px; background: #e8f0fe; border-radius: 8px;`).
- Desacoplamiento resiliente en `onNuevoUsuario` para que los correos de bienvenida no bloqueen transacciones ni queden silenciados ante excepciones de transporte.

### 2.2 Backend: Endpoints de Verificación OTP (`api/src/otpVerification.ts`)
- **`POST /api/enviarCodigoOTP`:**
  - Entrada: `{ email: string, nombre?: string }`.
  - Rate Limiting: 1 llamada cada 60 segundos por hash de email (`rate_limits/email:{sha256(email)}`).
  - Generador: `crypto.randomInt(100000, 1000000).toString()`.
  - Persistencia: `otpsVerificacion/{sha256(email)}` con `{ otpHash, expira, intentos: 0, maxIntentos: 5, creado }`.
- **`POST /api/verificarCodigoOTP`:**
  - Entrada: `{ email: string, codigo: string }`.
  - Comprobaciones: Existencia de registro, expiración (`Date.now() < expira`), límite de reintentos (`intentos < maxIntentos`).
  - Si el hash coincide:
    - Actualización autoritativa de Firebase Auth vía `admin.auth().updateUser(uid, { emailVerified: true })`.
    - Actualización del documento en Firestore `usuarios/{uid}` con `{ emailVerified: true, verificadoEn: now }`.
    - Eliminación del documento OTP en `otpsVerificacion/{sha256(email)}`.
  - Si el hash no coincide:
    - Incremento atómico del contador de intentos (`intentos: intentos + 1`).
    - Si llega al límite de 5, eliminación inmediata del OTP y rechazo con error `resource-exhausted`.

### 2.3 Frontend: Interfaz Reactiva y Accesible (`src/components/Auth/`)
- **`OtpInput.tsx`:** 6 cajas de entrada individuales con auto-foco inmediato al escribir, retroceso inteligente con `Backspace`, soporte completo de pegado desde portapapeles (`onPaste`), atributos móviles `inputMode="numeric"` y `pattern="[0-9]*"`.
- **`VerificarEmail.tsx`:** Orquestación visual con manejo de estados (`AWAITING_INPUT`, `VERIFYING`, `SUCCESS`, `EDITING_EMAIL`).
- **`CooldownButton.tsx`:** Reutilización del temporizador visual de 60 segundos con persistencia en `sessionStorage` para el reenvío del código.
- **`CambiarEmailModal.tsx`:** Vía de escape ante errores tipográficos en el correo, permitiendo corregir la dirección y reenviar el código OTP sin salir del flujo.
- **`SuccessCelebration.tsx`:** Animación de confirmación con checkmark animado en SVG y redirección automática en 3 segundos al panel de control (`/`).
- **`AuthContext.tsx`:** Integración de los métodos `enviarCodigoOTP(email?: string)` y `verificarCodigo(codigo: string, email?: string)`.

---

## 4. Impacto en Métricas y Beneficios

1. **Incremento en Tasa de Conversión:** Eliminación del 100% de los problemas de pre-fetching de bots y desincronización de sesiones multi-dispositivo.
2. **Entregabilidad y Velocidad:** Resend API garantiza una tasa de entrega en bandeja principal > 99.8% con tiempos de recepción menores a 5 segundos.
3. **Seguridad Robusta:** Cero almacenamiento de OTPs en texto plano (hashing SHA-256 en base de datos) y protección estricta contra ataques de fuerza bruta (máximo 5 intentos y rate limit de 1 envío por minuto).
4. **Resiliencia Operativa:** Arquitectura desacoplada con fallbacks automáticos para desarrollo y contingencias de transporte.

---

## 5. Alternativas Consideradas y Descartadas

| Alternativa | Razón de Descarte |
|---|---|
| **Seguir con Enlaces de Verificación (*Magic Links*)** | Causa fricción masiva en clientes móviles, prefetch destructivo por antivirus de email y desincronización de cookies/tokens entre pestañas. |
| **SDK Nativo de Resend (`npm i resend`)** | Innecesario y añade dependencias externas pesadas al backend Express. Un simple `fetch` REST con tipado estricto es más rápido, ligero y seguro. |
| **Almacenar OTP en texto plano en Firestore** | Inaceptable desde el punto de vista de seguridad. Un hash SHA-256 previene ataques en caso de fuga o lectura no autorizada de la base de datos. |
| **Generar OTPs con `Math.random()`** | Descartado por ser pseudocriptográficamente inseguro. Se exige `crypto.randomInt`. |
