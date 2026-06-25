# StreamControl Pro — Documentación del Sistema

## 1. Visión General

StreamControl Pro es una plataforma SaaS para gestión de negocios de reventa de servicios de streaming. Permite administrar clientes, ventas, cuentas de streaming con múltiples perfiles, y códigos de verificación con extracción automática vía IMAP.

**URL de producción**: https://streamcontrol-10837.web.app
**Firebase Console**: https://console.firebase.google.com/project/streamcontrol-10837

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + TypeScript + Vite 5 |
| **Estilos** | Tailwind CSS 3 + Lucide icons |
| **Routing** | React Router v6 (`BrowserRouter` con `basename=/app`) |
| **Estado global** | React Context + hooks (sin Redux/Zustand) |
| **PWA** | vite-plugin-pwa + Workbox |
| **Backend** | Firebase (Firestore, Auth, Functions, Hosting) |
| **Cloud Functions** | Node.js 22, Firebase Functions v1 (1ª gen) |
| **IMAP** | imapflow + mailparser (extracción de códigos) |
| **Testing** | Vitest + Testing Library (jsdom) |
| **CI/CD** | Firebase CLI, deploys manuales |

---

## 3. Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     Firebase Hosting                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ / (landing)  │  │ /app/ (SPA)  │  │ /r/ (consulta)│   │
│  │ index.html   │  │ app/index.   │  │ app/index.    │   │
│  │              │  │    html      │  │    html       │   │
│  └─────────────┘  └──────┬───────┘  └──────┬────────┘   │
│                          │                  │            │
└──────────────────────────┼──────────────────┼────────────┘
                           │                  │
                    ┌──────▼───────┐   ┌──────▼────────┐
                    │  BrowserRouter│   │  (directo,    │
                    │ basename=/app │   │  sin Router)  │
                    │  App.tsx      │   │  PublicConsulta│
                    └──────┬───────┘   └──────┬────────┘
                           │                  │
                    ┌──────▼──────────────┐   │
                    │   React SPA Routes  │   │
                    │   /login, /,        │   │
                    │   /ventas, /cuentas │   │
                    │   /r/:token, ...    │   │
                    └────────────────────┘   │
                                      ┌──────▼────────┐
                                      │ ConsultaPublica│
                                      │ Firebase Auth  │
                                      │ NO requerida   │
                                      └──────┬────────┘
                                             │
                    ┌────────────────────────┴──────────┐
                    │         Cloud Functions            │
                    │  ┌──────────┐ ┌───────────────┐   │
                    │  │generar   │ │consultarCodigo │   │
                    │  │Token     │ │validarToken    │   │
                    │  └──────────┘ └───────┬───────┘   │
                    │  ┌──────────┐ ┌───────▼───────┐   │
                    │  │toggle   │ │  IMAP Client   │   │
                    │  │Token    │ │  imapflow      │   │
                    │  └──────────┘ └───────┬───────┘   │
                    └──────────────────────┼────────────┘
                                           │
                    ┌──────────────────────▼────────────┐
                    │          Firestore                │
                    │  usuarios, clientes, ventas,      │
                    │  cuentas, cuentas_secretos,       │
                    │  tokens, planes, suscripciones,   │
                    │  notificaciones, notificacionesEmail│
                    └───────────────────────────────────┘
```

---

## 4. Firebase Hosting — Routing

### 4.1. Configuración (`firebase.json`)

```json
{
  "redirects": [
    { "source": "/login", "destination": "/app/login", "type": 302 }
  ],
  "rewrites": [
    { "source": "/r/**", "destination": "/app/index.html" },
    { "source": "/app/**", "destination": "/app/index.html" },
    { "source": "**", "destination": "/index.html" }
  ]
}
```

### 4.2. Orden de evaluación

1. **Redirects primero**: `/login` → 302 → `/app/login`
2. **Rewrites después**: en orden de definición:
   - `/r/**` → sirve SPA (consulta pública)
   - `/app/**` → sirve SPA (app principal)
   - `**` → sirve landing page (catch-all)

### 4.3. Mapa de URLs

| URL | Firebase Rule | Archivo servido | React Router |
|-----|--------------|----------------|--------------|
| `/` | rewrite `**` | `dist/index.html` (landing) | — |
| `/app/` | rewrite `/app/**` | `dist/app/index.html` | Ruta `/` (Dashboard) |
| `/app/login` | rewrite `/app/**` | `dist/app/index.html` | Ruta `/login` |
| `/app/ventas` | rewrite `/app/**` | `dist/app/index.html` | Ruta `/ventas` |
| `/app/r/TOKEN` | rewrite `/app/**` | `dist/app/index.html` | Ruta `/r/:token` |
| `/r/TOKEN` | rewrite `/r/**` | `dist/app/index.html` | Handler directo (sin Router) |
| `/login` | redirect 302 | → `/app/login` | — |
| `/random` | rewrite `**` | `dist/index.html` (landing) | — |
| `/solicitar.html` | archivo estático | `dist/solicitar.html` | — |

### 4.4. Flujo de consulta pública (`/r/TOKEN`)

Este es el flujo más complejo y donde hay una solución específica:

1. Usuario abre `https://streamcontrol-10837.web.app/r/uuid-v4`
2. Firebase Hosting hace **rewrite** → sirve `dist/app/index.html` (SPA)
3. React bootea, `App.tsx` detecta `window.location.pathname.startsWith('/r/')`
4. Renderiza `PublicConsulta` con el token extraído del pathname
5. `PublicConsulta` llama a `validarToken` CF → si es válido, muestra el selector de casos
6. Usuario selecciona caso → llama a `consultarCodigo` CF → IMAP → código mostrado

**Legacy**: `/app/r/TOKEN` también funciona mediante el routing normal de React Router con basename `/app`.

> ⚠️ **Por qué rewrite y no redirect**: Firebase Hosting ignora silenciosamente los capture groups (`:splat`, `:1`) en las reglas de redirect. Se validó experimentalmente: redirects con wildcard y destino hardcodeado funcionan, pero con `:splat` en el destino la regla completa es descartada.

---

## 5. Modelo de Datos (Firestore)

### 5.1. Colección `usuarios`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `uid` | string (PK) | Firebase Auth UID (coincide con doc ID) |
| `nombre` | string | Nombre del usuario |
| `correo` | string | Email |
| `rol` | `admin \| usuario` | Rol del usuario |
| `moneda` | `'COP' \| 'USD' \| 'MXN' \| 'CLP' \| 'ARS' \| 'PEN'` | Moneda preferida |
| `cuentaActiva` | boolean | Estado de la cuenta |
| `notificacionesEmail` | boolean | Preferencia de notificaciones |
| `createdAt` | Timestamp | Fecha de registro |

### 5.2. Colección `clientes`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| *(doc ID)* | string | ID auto-generado |
| `nombre` | string | Nombre del cliente |
| `telefono` | string | Número de contacto |
| `plataforma` | string | Servicio contratado (Netflix, Win, etc.) |
| `fechaVencimiento` | string (YYYY-MM-DD) | Próximo vencimiento |
| `precio` | number | Precio del servicio |
| `saldoPendiente` | number | Deuda (si aplica) |
| `estado` | `'activo' \| 'inactivo'` | Estado del cliente |
| `propietarioId` | string (ref: usuarios) | Dueño del cliente |
| `usuarioEmail` | string | Email del dueño (para notificaciones) |
| `fechaVenta` | Timestamp | Fecha de registro |
| `esSubdistribuidor` | boolean | Si es sub-distribuidor |
| moneda, utilidad, etc. | varios | Más campos de venta |

### 5.3. Colección `ventas`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| *(doc ID)* | string | ID auto-generado |
| `clienteId` | string (ref: clientes) | Cliente asociado |
| `clienteNombre` | string | Nombre del cliente (desnormalizado) |
| `plataforma` | string | Servicio vendido |
| `fechaInicio` | string (YYYY-MM-DD) | Inicio del período |
| `fechaFin` | string (YYYY-MM-DD) | Fin del período |
| `precio` | number | Precio de venta |
| `utilidad` | number | Precio - costo |
| `propietarioId` | string | Dueño de la venta |
| `createdAt` | Timestamp | Fecha de registro |
| `cuentaId` | string (ref: cuentas, opcional) | Cuenta asignada |
| `perfilAsignado` | string (opcional) | Perfil/PIN asignado |

### 5.4. Colección `cuentas`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| *(doc ID)* | string | ID auto-generado |
| `proveedor` | string | Netflix, Win, ChatGPT, Max, Universal+ |
| `correoCuenta` | string | Email de la cuenta de streaming |
| `perfiles` | array<{nombre, pin}> | Perfiles disponibles |
| `perfilesAsignados` | array<{nombre, clienteId}> | Perfiles asignados |
| `estado` | `'disponible' \| 'asignada' \| 'expirada'` | Estado |
| `fechaInicio` | string (YYYY-MM-DD) | Inicio del período de servicio |
| `fechaVencimiento` | string (YYYY-MM-DD) | Vencimiento del período |
| `diasRestantes` | number | Días hasta vencer (calculado) |
| `propietarioId` | string | Dueño de la cuenta |

### 5.5. Colección `cuentas_secretos`

Protegida por Firestore Rules: **denegado todo acceso desde cliente**. Solo Admin SDK.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `cuentaId` | string (PK, mismo ID que cuentas) | Cuenta asociada |
| `correo` | string | Email IMAP |
| `contrasena` | string | Contraseña IMAP |
| `imapHost` | string | Host IMAP (ej: imap.gmail.com) |
| `imapPort` | number | Puerto IMAP (993) |
| `proveedorIMAP` | `'gmail' \| 'outlook'` | Proveedor de correo |

### 5.6. Colección `tokens`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `token` | string (PK, UUID v4) | Token único |
| `cuentaId` | string (ref: cuentas) | Cuenta asociada |
| `perfilNombre` | string | Perfil específico |
| `clienteId` | string | Cliente asignado |
| `clienteNombre` | string | Nombre del cliente (desnormalizado) |
| `vendedorId` | string | Creador del token |
| `expiraEn` | string (ISO) | Fecha de expiración |
| `activo` | boolean | Si está activo (revocable) |
| `useCount` | number | Consultas exitosas (máx 10) |
| `rateLimit` | { count, windowStart } | Rate limiting (5/min) |
| `createdAt` | Timestamp | Fecha de creación |

### 5.7. Colección `planes`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| *(doc ID)* | string | Nombre del plan (starter, professional, enterprise) |
| `nombre` | string | Nombre visible |
| `descripcion` | string | Descripción |
| `precio` | number | Precio por período |
| `moneda` | string | Moneda del precio |
| `caracteristicas` | string[] | Lista de features |
| `limiteClientes` | number | Máx clientes (0 = ilimitado) |
| `orden` | number | Orden de visualización |

### 5.8. Colección `suscripciones`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| *(doc ID)* | string | ID auto-generado |
| `usuarioId` | string (ref: usuarios) | Suscriptor |
| `usuarioNombre` | string | Nombre (desnormalizado) |
| `planId` | string (ref: planes) | Plan contratado |
| `planNombre` | string | Nombre del plan |
| `estado` | `'activa' \| 'expirada' \| 'cancelada'` | Estado |
| `fechaInicio` | Timestamp | Inicio |
| `fechaFin` | Timestamp | Fin del período |
| `monedaPago` | string | Moneda |

### 5.9. Colección `notificaciones`

Generadas por el cron diario. Incluyen vencimientos de clientes, mora, suscripciones por vencer, cuentas por vencer.

### 5.10. Colección `config`

Documento único con configuración global: WhatsApp de soporte, etc.

### 5.11. Colección `notificacionesEmail`

Documentos temporales para enviar emails de notificación (password_changed, email_changed). El trigger `onNotificacionEmail` los procesa.

---

## 6. Autenticación y Autorización

### 6.1. Firebase Auth

- Login: email + contraseña
- Registro: email + contraseña + selección de moneda
- Recuperación: email con link de reset via Cloud Function

### 6.2. Firestore Security Rules

- **Propietario**: cada documento tiene `propietarioId = request.auth.uid`
- **Admin**: acceso de lectura a TODOS los documentos (visibilidad global)
- **Usuario regular**: solo lectura/escritura de sus propios documentos
- **`cuentas_secretos`**: denegado todo (solo Admin SDK via Cloud Functions)
- **`tokens`**: lectura pública para `validarToken`, escritura solo Admin SDK
- **`config`**: lectura pública para WhatsApp de soporte

### 6.3. Roles

| Rol | Acceso |
|-----|--------|
| `admin` | Todos los datos de todos los usuarios, gestión de planes/suscripciones |
| `usuario` | Solo sus propios clientes, ventas, cuentas |

### 6.4. Planes (permisos por suscripción)

| Funcionalidad | Starter | Professional | Enterprise |
|--------------|---------|-------------|------------|
| Límite clientes | 30 | Ilimitado | Ilimitado |
| Telegram | ❌ | ✅ | ✅ |
| Reportes | ❌ | ✅ | ✅ |
| Exportar Excel | ✅ | ✅ | ✅ |
| Dashboard ejecutivo | ❌ | ❌ | ✅ |
| Gestión cuentas | ❌ | ✅ | ✅ |
| Generar tokens | ❌ | ❌ | ✅ |

---

## 7. Sistema de Rutas (React Router)

### 7.1. Configuración

```tsx
<BrowserRouter basename="/app">
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<PrivateRoute roles={['admin','usuario']}><Layout /></PrivateRoute>}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/ventas" element={<Ventas />} />
      <Route path="/reportes" element={<Reportes />} />
      <Route path="/usuarios" element={<Usuarios />} />
      <Route path="/GestionClientes" element={<GestionClientes />} />
      <Route path="/telegram" element={<TelegramConfig />} />
      <Route path="/admin/planes" element={<AdminPlanes />} />
      <Route path="/admin/suscripciones" element={<AdminSuscripciones />} />
      <Route path="/ajustes" element={<Ajustes />} />
      <Route path="/cuentas" element={<GestionCuentas />} />
      <Route path="/consulta-codigos" element={<ConsultaCodigos />} />
    </Route>
    <Route path="/r/:token" element={<ConsultaPublica />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</BrowserRouter>
```

### 7.2. Ruta pública `/r/:token`

Es la única ruta que no pasa por `PrivateRoute` ni `Layout`. Renderiza `ConsultaPublica` sin sidebar, sin header, sin autenticación.

Además del routing normal, existe un handler por fuera del BrowserRouter que detecta `/r/` en `window.location.pathname` y renderiza `ConsultaPublica` directamente, para soportar las URLs servidas via rewrite de Firebase (sin el prefijo `/app`).

### 7.3. Flujo de render de páginas

| Componente | Ruta | Layout | Auth | Roles |
|-----------|------|--------|------|-------|
| `Login` | `/login` | No | No | — |
| `Dashboard` | `/` | Sí | Sí | admin, usuario |
| `Ventas` | `/ventas` | Sí | Sí | usuario |
| `Reportes` | `/reportes` | Sí | Sí | usuario |
| `Usuarios` | `/usuarios` | Sí | Sí | admin |
| `GestionClientes` | `/GestionClientes` | Sí | Sí | usuario |
| `TelegramConfig` | `/telegram` | Sí | Sí | admin, usuario |
| `AdminPlanes` | `/admin/planes` | Sí | Sí | admin |
| `AdminSuscripciones` | `/admin/suscripciones` | Sí | Sí | admin |
| `Ajustes` | `/ajustes` | Sí | Sí | admin, usuario |
| `GestionCuentas` | `/cuentas` | Sí | Sí | admin, usuario |
| `ConsultaPublica` | `/r/:token` | No | No | — |
| `ConsultaCodigos` | `/consulta-codigos` | Sí | Sí | admin, usuario |

---

## 8. Cloud Functions

### 8.1. Catálogo completo

| Función | Tipo | Timeout | Secrets | Descripción |
|---------|------|---------|---------|-------------|
| `onNuevoUsuario` | Firestore trigger | — | SMTP_USER, SMTP_PASS | Email de bienvenida al registrarse |
| `onNotificacionEmail` | Firestore trigger | — | SMTP_USER, SMTP_PASS | Email de cambio password/correo |
| `enviarCorreoRecuperacion` | Callable (15s) | 15s | SMTP_USER, SMTP_PASS | Enlace de reset password con rate limit (1/min) |
| `telegramWebhook` | HTTP | — | TELEGRAM_TOKEN, TELEGRAM_WEBHOOK_SECRET | Webhook del bot de Telegram |
| `generarNotificacionesVencimientos` | PubSub (24h) | — | TELEGRAM_TOKEN, TELEGRAM_WEBHOOK_SECRET | Notificaciones de vencimientos + mora + auto-expiracion suscripciones |
| `generarToken` | Callable (30s) | 30s | — | Crea token UUID para consulta de códigos (solo Enterprise) |
| `validarToken` | Callable (15s) | 15s | — | Valida token, devuelve casos disponibles |
| `consultarCodigo` | Callable (60s) | 60s | — | Conecta IMAP, busca email, extrae código |
| `guardarCredenciales` | Callable (15s) | 15s | — | Guarda credenciales IMAP en `cuentas_secretos` (Admin SDK) |
| `toggleToken` | Callable (15s) | 15s | — | Activa/desactiva un token |
| `consultarCodigoDirecto` | Callable (60s) | 60s | — | Consulta interna (sin token), con rate limit propio |
| `generarTokenSubdistribuidor` | Callable (30s) | 30s | — | Genera tokens para sub-distribuidores (solo Enterprise) |

### 8.2. Configuración de Secrets

```bash
# SMTP para emails transaccionales
firebase functions:secrets:set SMTP_USER       # correo@gmail.com
firebase functions:secrets:set SMTP_PASS       # contraseña de aplicación

# Telegram Bot
firebase functions:secrets:set TELEGRAM_TOKEN          # bot token
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET # webhook secret
```

### 8.3. Sistema de Códigos (IMAP)

El sistema de consulta de códigos funciona así:

1. **Token público** (link corto `/r/uuid`): el vendedor genera un token para un cliente específico
2. **El cliente abre el link**: sin autenticarse, ve un selector de casos
3. **Selecciona el caso**: viaje Netflix, código hogar, inicio sesión, etc.
4. **Cloud Function** `consultarCodigo` conecta vía IMAP al correo de la cuenta de streaming
5. **Busca emails** del remitente correspondiente (Netflix, Max, etc.) en las últimas 24h
6. **Filtra por asunto** según el caso seleccionado
7. **Extrae el código** mediante regex específico por tipo (4-6 dígitos)
8. **Muestra el código** al cliente con opción de copiar

**Reglas de negocio**:
- Máx 10 consultas exitosas por token
- Máx 5 consultas por minuto por token
- Token expira por defecto a los 30 días (configurable)
- Token revocable por el vendedor
- El caso "Cambiar contraseña" solo está disponible en consulta interna, NO en el link público

**Proveedores y remitentes IMAP**:

| Servicio | Remitentes |
|----------|-----------|
| Netflix | info@account.netflix.com, info@netflix.com |
| Max | no-reply@max.com, info@hbomax.com |
| ChatGPT | no-reply@openai.com |
| Win | no-reply@winplay.co, notificaciones@claro.com.co |
| Universal+ | no-reply@universalplus.com |

---

## 9. Estructura del Proyecto

```
streamcontrol/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.tsx          # Login + Registro dual (toggle)
│   │   │   └── PrivateRoute.tsx   # Guardia de autenticación + roles
│   │   ├── AnalyticsTracker.tsx   # Google Analytics (G-87R3DYVTQS)
│   │   ├── CasoSelector.tsx       # Selector de tipo de código
│   │   ├── CodeResult.tsx         # Resultado con copia al portapapeles
│   │   ├── ConfigurarIMAP.tsx     # Configuración IMAP de cuentas
│   │   ├── ConsultaInterna.tsx    # Consulta de códigos interna (con auth)
│   │   ├── CuentaDetail.tsx       # Detalle de cuenta + asignación perfiles
│   │   ├── CuentaForm.tsx         # Formulario de alta/edición de cuentas
│   │   ├── DropdownMenu.tsx       # Menú de acciones
│   │   ├── ErrorBoundary.tsx      # Captura de errores de React
│   │   ├── FeatureBlocked.tsx     # Bloqueo por plan
│   │   ├── Layout.tsx             # Sidebar + header + navegación
│   │   ├── NotificationsPanel.tsx # Panel de notificaciones
│   │   ├── Paginador.tsx          # Paginación reutilizable
│   │   ├── PlanForm.tsx           # Formulario de planes (admin)
│   │   ├── PWAInstallButton.tsx   # Botón de instalación PWA
│   │   ├── SelectorCuenta.tsx     # Selector de cuentas en ventas
│   │   ├── SuscripcionCard.tsx    # Card de suscripción
│   │   ├── UpgradeModal.tsx       # Modal de upgrade de plan
│   │   └── VentasForm.tsx         # Formulario de ventas
│   ├── contexts/
│   │   ├── AuthContext.tsx         # Auth + registro + perfil
│   │   └── UpgradeModalContext.tsx # Contexto del modal de upgrade
│   ├── hooks/
│   │   ├── useAdminConfig.ts      # Config global (WhatsApp)
│   │   ├── useClientes.ts         # CRUD clientes + caché
│   │   ├── useClientesConNotificaciones.ts
│   │   ├── useCuentas.ts          # CRUD cuentas streaming
│   │   ├── useMoneda.ts           # Formateo multi-moneda
│   │   ├── useNotificaciones.ts   # Notificaciones del sistema
│   │   ├── usePermisos.ts         # Permisos por plan
│   │   ├── usePlanes.ts           # CRUD planes
│   │   ├── useSuscripciones.ts    # CRUD suscripciones
│   │   ├── useTokens.ts           # Gestión de tokens
│   │   └── useVentas.ts           # CRUD ventas
│   ├── pages/
│   │   ├── AdminPlanes.tsx        # Gestión de planes (admin)
│   │   ├── AdminSuscripciones.tsx # Gestión de suscripciones (admin)
│   │   ├── Ajustes.tsx            # Perfil y configuración
│   │   ├── ConsultaCodigos.tsx    # Consulta de códigos interna
│   │   ├── ConsultaPublica.tsx    # Consulta pública (/r/:token)
│   │   ├── Dashboard.tsx          # Dashboard ejecutivo
│   │   ├── GestionClientes.tsx    # CRUD clientes
│   │   ├── GestionCuentas.tsx     # CRUD cuentas streaming
│   │   ├── Reportes.tsx           # Reportes financieros
│   │   ├── TelegramConfig.tsx     # Config Telegram
│   │   ├── Usuarios.tsx           # Gestión usuarios (admin)
│   │   └── Ventas.tsx             # Registro de ventas
│   ├── types/                     # Tipos TypeScript
│   ├── utils/
│   │   └── formatearPrecio.ts     # Formateo de precios
│   ├── test/
│   │   ├── setup.ts              # Config vitest
│   │   └── mocks.ts              # Mocks de Firebase
│   ├── firebase.ts               # Init Firebase
│   ├── App.tsx                   # Router principal + handler /r/
│   └── main.tsx                  # Entry point
├── functions/
│   ├── src/
│   │   ├── codigos.ts            # Tokens, validación, consulta IMAP
│   │   ├── imap.ts               # Conexión IMAP + extracción
│   │   └── regex.ts              # Patrones de extracción por tipo
│   ├── index.ts                  # Triggers, webhooks, cron, email
│   ├── email.ts                  # SMTP con nodemailer
│   ├── telegram.ts              # Bot de Telegram
│   └── package.json
├── landing/
│   ├── index.html               # Landing page principal
│   └── solicitar.html           # Página de solicitud de plan
├── public/
│   └── stream.webp              # Logo / favicon
├── firebase.json                # Config Firebase Hosting
├── firestore.rules              # Reglas de seguridad (435 líneas)
├── firestore.indexes.json       # Índices compuestos
├── vite.config.ts               # Build + PWA + testing
└── .env.example                 # Variables de entorno
```

---

## 10. Testing

### 10.1. Tests existentes

**12 archivos, 88 tests** — todos pasando actualmente.

| Archivo | Tipo | Tests |
|---------|------|-------|
| `components/UpgradeModal.test.tsx` | Componente | ✅ |
| `components/CuentaForm.test.tsx` | Componente | ✅ |
| `components/CasoSelector.test.tsx` | Componente | ✅ |
| `components/VentasForm.test.tsx` | Componente | ✅ |
| `hooks/useSuscripciones.test.ts` | Hook | ✅ |
| `hooks/useClientes.test.ts` | Hook | ✅ |
| `hooks/useClientesConNotificaciones.test.ts` | Hook | ✅ |
| `hooks/useVentas.test.ts` | Hook | ✅ |
| `hooks/usePlanes.test.ts` | Hook | ✅ |
| `hooks/useCuentas.test.ts` | Hook | ✅ |
| `pages/AdminPlanes.test.tsx` | Página | ✅ |
| `pages/AdminSuscripciones.test.tsx` | Página | ✅ |

### 10.2. Comandos

```bash
npx vitest run          # Una vez
npx vitest              # Modo watch
npx vitest run --coverage  # Con cobertura
```

### 10.3. Configuración

- Framework: Vitest v4 + Testing Library
- Entorno: jsdom (simula browser)
- Setup: `src/test/setup.ts` (importa `@testing-library/jest-dom`)

---

## 11. Variables de Entorno y Secrets

### 11.1. Frontend (`.env`)

```
VITE_API_KEY=...
VITE_AUTH_DOMAIN=...
VITE_PROJECT_ID=streamcontrol-10837
VITE_STORAGE_BUCKET=...
VITE_MESSAGING_SENDER_ID=...
VITE_APP_ID=...
```

### 11.2. Cloud Functions Secrets

```bash
# Email (nodemailer + Gmail SMTP)
firebase functions:secrets:set SMTP_USER    # ejemplo@gmail.com
firebase functions:secrets:set SMTP_PASS    # contraseña de aplicación Gmail

# Telegram Bot
firebase functions:secrets:set TELEGRAM_TOKEN
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
```

---

## 12. Despliegue

### 12.1. Pipeline completo

```bash
# 1. Recompilar Cloud Functions (si hay cambios en functions/)
cd functions && npx tsc && cd ..

# 2. Buildear SPA + copiar landing pages
npm run build    # → dist/app/ (SPA) + dist/index.html (landing)

# 3. Commit + push
git add .
git commit -m "descripción del cambio"
git push

# 4. Deployar
firebase deploy

# Deploy específico:
firebase deploy --only hosting          # Frontend + landing
firebase deploy --only functions        # Cloud Functions
firebase deploy --only firestore:rules  # Reglas de seguridad
```

### 12.2. Notas importantes

- **Siempre** rebuildear después de cambios en `App.tsx` o componentes
- **Siempre** correr `npx tsc` en `functions/` antes de deployar Functions
- La SPA compila a `dist/app/` (Vite `base: '/app/'`)
- El script `build` copia `landing/index.html` → `dist/` y `landing/solicitar.html` → `dist/`
- El favicon se elimina automáticamente del build (`rm -f dist/favicon.ico`)

---

## 13. Limitaciones Conocidas

### 13.1. Firebase Hosting `:splat` en redirects

Firebase Hosting **ignora silenciosamente** las reglas de redirect que contienen capture groups (`:splat`, `:1`) en el destino. La regla completa se descarta sin error.

**Solución actual**: Usar rewrite en vez de redirect, y manejar el pathname manualmente en `App.tsx`.

### 13.2. IMAP y conexiones lentas

La conexión IMAP tiene timeout de 10 segundos. Algunos proveedores (especialmente Outlook) pueden ser lentos. La CF tiene timeout de 60s pero la conexión falla antes si el servidor no responde.

### 13.3. Rate limiting en memoria

Los rate limiters de `consultarCodigoDirecto` y `enviarCorreoRecuperacion` usan `Map` en memoria. Se resetean cuando la instancia de Functions se recicla. No es un problema real para el uso actual pero podría serlo a escala.

### 13.4. Sin tests de routing

No hay tests para el routing (ni el handler de `/r/` ni la configuración de Firebase Hosting). Los tests existentes cubren componentes y hooks.

---

## 14. Monitoreo y Observabilidad

- **Google Analytics**: G-87R3DYVTQS — configurado via `AnalyticsTracker.tsx` (trackea page views en SPA) + Google Tag en landing pages
- **Firebase Functions logs**: `firebase functions:log`
- **Firebase Console**: dashboard de uso, errores, y rendimiento

---

## 15. Glosario

| Término | Significado |
|---------|-------------|
| **CF** | Cloud Function |
| **IMAP** | Protocolo para leer emails (usado para extraer códigos) |
| **SPA** | Single Page Application (React) |
| **Landing page** | Página pública de aterrizaje (HTML estático) |
| **Token** | UUID para consulta pública de códigos |
| **Caso** | Tipo de código a consultar (viaje, hogar, inicio sesión, etc.) |
| **Perfil** | Sub-cuenta dentro de una cuenta de streaming |
| **SMTP** | Protocolo para enviar emails (usado para notificaciones) |
