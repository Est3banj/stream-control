# StreamControl Pro — Sistema de Gestión de Suscripciones

StreamControl Pro es una plataforma premium para la gestión eficiente de negocios de reventa de servicios de streaming. Permite el control total de clientes, ventas, cuentas de streaming, vencimientos, reportes financieros y consulta de códigos de verificación con automatización y multi-moneda.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Estilos** | Tailwind CSS |
| **Backend** | Firebase (Firestore, Auth, Functions, Hosting) |
| **Cloud Functions** | Node.js 22 (1ª Gen) con TypeScript |
| **Conexión IMAP** | imapflow + mailparser (códigos de verificación) |
| **Notificaciones** | Telegram Bot API + nodemailer (SMTP Gmail) |
| **Estado global** | React Context + hooks con shared listeners |
| **Testing** | Vitest + Testing Library |
| **PWA** | Service Worker con Workbox (vite-plugin-pwa) |

---

## Estructura del Proyecto

```
streamcontrol/
├── src/
│   ├── components/           # Componentes reutilizables
│   │   ├── Auth/             # Login, PrivateRoute
│   │   ├── CasoSelector.tsx  # Selector de casos de códigos
│   │   ├── CodeResult.tsx    # Resultado de consulta de código
│   │   ├── ConfigurarIMAP.tsx# Configuración IMAP por cuenta
│   │   ├── ConsultaInterna.tsx# Consulta interna de códigos
│   │   ├── CuentaDetail.tsx  # Detalle de cuenta de streaming
│   │   ├── CuentaForm.tsx    # Formulario de cuenta
│   │   ├── DropdownMenu.tsx  # Menú desplegable de acciones
│   │   ├── ErrorBoundary.tsx
│   │   ├── Layout.tsx        # Sidebar + navegación
│   │   ├── NotificationsPanel.tsx
│   │   ├── SelectorCuenta.tsx# Selector de cuentas en ventas
│   │   ├── UpgradeModal.tsx
│   │   └── VentasForm.tsx    # Formulario de ventas
│   ├── contexts/             # Estado global
│   │   ├── AuthContext.tsx   # Autenticación + registro
│   │   └── UpgradeModalContext.tsx
│   ├── hooks/                # Lógica de negocio
│   │   ├── useCuentas.ts     # Gestión de cuentas streaming
│   │   ├── useClientes.ts
│   │   ├── useMoneda.ts      # Formateo multi-moneda
│   │   ├── useNotificaciones.ts
│   │   ├── usePermisos.ts    # Permisos por plan
│   │   ├── usePlanes.ts
│   │   ├── useSuscripciones.ts
│   │   ├── useTokens.ts      # Tokens de consulta de códigos
│   │   └── useVentas.ts
│   ├── pages/                # Vistas principales
│   │   ├── AdminPlanes.tsx
│   │   ├── AdminSuscripciones.tsx
│   │   ├── Ajustes.tsx       # Perfil de usuario
│   │   ├── ConsultaPublica.tsx # Página pública de códigos (/r/:token)
│   │   ├── Dashboard.tsx
│   │   ├── GestionClientes.tsx
│   │   ├── GestionCuentas.tsx # Gestión de cuentas streaming
│   │   ├── Reportes.tsx
│   │   ├── TelegramConfig.tsx
│   │   ├── Usuarios.tsx
│   │   └── Ventas.tsx
│   ├── types/                # Tipos TypeScript
│   │   ├── cuenta.ts
│   │   ├── cliente.ts
│   │   ├── plan.ts
│   │   ├── suscripcion.ts
│   │   ├── token.ts
│   │   ├── usuario.ts
│   │   └── venta.ts
│   ├── utils/                # Utilidades
│   │   └── formatearPrecio.ts
│   ├── firebase.ts           # Configuración Firebase
│   └── App.tsx               # Router principal
├── functions/                # Cloud Functions
│   ├── src/
│   │   ├── codigos.ts        # Tokens, validación, consulta IMAP
│   │   ├── imap.ts           # Conexión IMAP + extracción de códigos
│   │   └── regex.ts          # Patrones de extracción de códigos
│   ├── index.ts              # Triggers + exports
│   ├── email.ts              # Módulo de correos (nodemailer)
│   ├── telegram.ts           # Bot de Telegram
│   └── package.json
├── firestore.rules           # Reglas de seguridad
├── firestore.indexes.json
├── firebase.json
└── .env.example
```

---

## Funcionalidades Principales

### Autenticación y Usuarios
- **Login/Registro dual** en una misma pantalla con toggle
- **Registro con multi-moneda**: el usuario selecciona su moneda preferida (COP, USD, MXN, CLP, ARS, PEN) al crearse la cuenta
- **Roles**: `admin` (visibilidad global) y `usuario` (solo sus datos)

### Perfil de Usuario (Ajustes)
- Cambio de nombre, correo electrónico y contraseña
- Recuperación de contraseña vía email

### Gestión de Clientes
- CRUD completo de clientes con estado activo/inactivo
- Historial de ventas por cliente
- Cobro de saldos pendientes
- Renovación directa desde el cliente
- Exportación a CSV
- Filtros por estado, búsqueda y paginación
- Envío de WhatsApp

### Gestión de Ventas
- Registro de ventas con selección de plataforma, fechas y precios
- Selector de cuentas de streaming con perfiles disponibles
- Asignación manual de perfil/PIN para cuentas de terceros
- Cálculo automático de utilidad
- Detección de cliente existente por nombre o teléfono
- Límite de clientes según el plan

### Gestión de Cuentas de Streaming
- Registro de cuentas con múltiples perfiles
- Asignación de perfiles a clientes existentes (desde tabla o detalle)
- Estado: disponible / asignada (automático al asignar el último perfil) / expirada
- Período del servicio con cálculo de vencimiento
- Días restantes con indicador verde/amarillo/rojo
- Exportación a CSV
- Filtros por proveedor, estado y búsqueda

### Sistema de Códigos de Verificación
- **Generación de tokens**: link único `/r/{uuid}` por cliente (solo Enterprise)
- **URL pública**: el cliente puede consultar códigos sin autenticarse
- **Casos por proveedor**: viaje, código hogar, inicio sesión, etc.
- **Cambiar contraseña**: solo visible en consulta interna, no en URL pública
- **Conexión IMAP**: busca el email correcto filtrando por asunto
- **Extracción inteligente**: regex ajustados por tipo de código (4-6 dígitos)
- **Rate limiting**: máx. 10 consultas exitosas por token, 5 por minuto
- **Revocar/reactivar tokens**: desde Gestión de Clientes

### Cloud Functions

| Función | Timeout | Propósito |
|---------|---------|-----------|
| `onNuevoUsuario` | - | Email de bienvenida |
| `onNotificacionEmail` | - | Email cambio password/correo |
| `enviarCorreoRecuperacion` | 15s | Enlace de reset password |
| `telegramWebhook` | - | Webhook del bot de Telegram |
| `generarNotificacionesVencimientos` | - | Notificaciones de vencimientos (cada 24h) |
| `generarToken` | 30s | Crea token UUID para consulta de códigos |
| `validarToken` | 15s | Valida token y devuelve casos disponibles |
| `consultarCodigo` | 60s | Conecta IMAP, busca email y extrae código |
| `guardarCredenciales` | 15s | Guarda credenciales IMAP en cuentas_secretos |
| `toggleToken` | 15s | Activa/desactiva un token |

### Planes y Suscripciones

| Feature | Starter | Professional | Enterprise |
|---------|---------|-------------|------------|
| Límite de clientes | 30 | Ilimitado | Ilimitado |
| Telegram | ❌ | ✅ | ✅ |
| Reportes avanzados | ❌ | ✅ | ✅ |
| Exportar Excel | ✅ | ✅ | ✅ |
| Dashboard ejecutivo | ❌ | ❌ | ✅ |
| Gestión de cuentas | ❌ | ✅ | ✅ |
| Generar tokens | ❌ | ❌ | ✅ |

### Multi-Moneda
- 6 monedas compatibles con tasas de conversión por defecto
- Hook `useMoneda()` para formateo en toda la app

### Seguridad
- **Firestore Rules**: acceso basado en roles y propietario
- **Cuentas secretos**: denegado desde cliente (solo Admin SDK)
- **Tokens**: creación solo desde Cloud Function con validación de plan
- **Estados**: verificación de cuenta activa/inactiva en cada login

---

## Configuración y Despliegue

### Requisitos
- Node.js 18+
- Cuenta de Firebase (plan Blaze para Functions)
- CLI de Firebase: `npm install -g firebase-tools`

### Desarrollo Local

```bash
# 1. Clonar e instalar
git clone https://github.com/Est3banj/stream-control.git
cd streamcontrol
npm install
cd functions && npm install && cd ..

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales de Firebase

# 3. Iniciar servidor de desarrollo
npm run dev
```

### Despliegue a Producción

```bash
# 1. Configurar secrets de Functions (solo la primera vez)
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS

# 2. Recompilar TypeScript de Functions (importante!)
cd functions && npx tsc && cd ..

# 3. Deployar todo
firebase deploy

# O deploy específico:
firebase deploy --only hosting          # Solo frontend
firebase deploy --only functions        # Solo Cloud Functions
firebase deploy --only firestore:rules  # Solo reglas
```

> **Nota**: Firebase Functions usa el código compilado en `functions/lib/`. Siempre ejecutar `npx tsc` en `functions/` antes de deployar para asegurar que los cambios en TypeScript se incluyan.

---

## Testing

```bash
# Ejecutar todos los tests
npx vitest run

# Modo watch
npx vitest

# Con coverage
npx vitest run --coverage
```

---

## Enlaces

- **App en producción**: https://streamcontrol-10837.web.app
- **Firebase Console**: https://console.firebase.google.com/project/streamcontrol-10837
- **Repositorio**: https://github.com/Est3banj/stream-control
