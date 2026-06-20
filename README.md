# StreamControl Pro — Sistema de Gestión de Suscripciones

StreamControl Pro es una plataforma premium para la gestión eficiente de negocios de reventa de servicios de streaming. Permite el control total de clientes, ventas, vencimientos y reportes financieros con automatización y multi-moneda.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Estilos** | Tailwind CSS |
| **Backend** | Firebase (Firestore, Auth, Functions, Hosting) |
| **Cloud Functions** | Node.js 22 (1ª Gen) con TypeScript |
| **Notificaciones** | Telegram Bot API + nodemailer (SMTP Gmail) |
| **Estado global** | React Context + hooks |
| **Testing** | Vitest + Testing Library |
| **PWA** | Service Worker con Workbox (vite-plugin-pwa) |

---

## Estructura del Proyecto

```
streamcontrol/
├── src/
│   ├── components/         # Componentes reutilizables
│   │   ├── Auth/           # Login, PrivateRoute
│   │   ├── ErrorBoundary.tsx
│   │   ├── Layout.tsx      # Sidebar + navegación
│   │   ├── UpgradeModal.tsx
│   │   ├── NotificationsPanel.tsx
│   │   └── ...
│   ├── contexts/           # Estado global
│   │   ├── AuthContext.tsx     # Autenticación + registro
│   │   └── UpgradeModalContext.tsx
│   ├── hooks/              # Lógica de negocio
│   │   ├── useClientes.ts
│   │   ├── useVentas.ts
│   │   ├── useNotificaciones.ts
│   │   ├── usePermisos.ts
│   │   ├── usePlanes.ts
│   │   ├── useSuscripciones.ts
│   │   └── useMoneda.ts        # Formateo multi-moneda
│   ├── pages/              # Vistas principales
│   │   ├── Dashboard.tsx
│   │   ├── Ventas.tsx
│   │   ├── Reportes.tsx
│   │   ├── GestionClientes.tsx
│   │   ├── Ajustes.tsx         # Perfil de usuario
│   │   ├── AdminPlanes.tsx
│   │   ├── AdminSuscripciones.tsx
│   │   ├── TelegramConfig.tsx
│   │   └── Usuarios.tsx
│   ├── types/              # Tipos TypeScript
│   │   ├── usuario.ts
│   │   ├── cliente.ts
│   │   ├── venta.ts
│   │   ├── plan.ts
│   │   ├── suscripcion.ts
│   │   └── ...
│   ├── utils/              # Utilidades
│   │   └── formatearPrecio.ts  # Conversión COP -> moneda destino
│   ├── firebase.ts         # Configuración Firebase (desde .env)
│   └── App.tsx             # Router principal
├── functions/              # Cloud Functions
│   ├── index.ts            # Triggers + endpoint
│   ├── email.ts            # Módulo de correos (nodemailer)
│   ├── telegram.ts         # Bot de Telegram
│   └── package.json
├── firestore.rules         # Reglas de seguridad
├── firestore.indexes.json  # Índices compuestos
├── firebase.json           # Configuración de deploy
└── .env.example            # Template de variables de entorno
```

---

## Funcionalidades Principales

### Autenticación y Usuarios
- **Login/Registro dual** en una misma pantalla con toggle
- **Registro con multi-moneda**: el usuario selecciona su moneda preferida (COP, USD, MXN, CLP, ARS, PEN) al crearse la cuenta
- **Roles**: `admin` (visibilidad global) y `usuario` (solo sus datos)

### Perfil de Usuario (Ajustes)
- Cambio de nombre
- Cambio de correo electrónico (con reautenticación + notificación)
- Cambio de contraseña (con reautenticación + confirmación)
- Recuperación de contraseña vía email

### Multi-Moneda
- 6 monedas compatibles con tasas de conversión por defecto
- Los precios se muestran en la moneda del usuario automáticamente
- Selector de moneda en el registro
- Hook `useMoneda()` para formateo en toda la app

### Cloud Functions
| Función | Trigger | Propósito |
|---------|---------|-----------|
| `onNuevoUsuario` | Firestore `.onCreate` usuarios | Email de bienvenida |
| `onNotificacionEmail` | Firestore `.onCreate` notificacionesEmail | Email cambio password/correo |
| `enviarCorreoRecuperacion` | HTTPS Callable | Enlace de reset password |
| `telegramWebhook` | HTTPS Request | Webhook del bot de Telegram |
| `generarNotificacionesVencimientos` | PubSub (cada 24h) | Notificaciones de vencimientos |

### Seguridad
- **Firestore Rules**: acceso basado en roles (`admin` vs `usuario`)
- **Cuentas vencidas**: cierre de sesión automático si `activoHasta` expiró
- **Estados**: verificación de cuenta activa/inactiva en cada login
- **Variables de entorno**: credenciales Firebase desde `.env` (nunca hardcodeadas)

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

# 2. Deployar todo
firebase deploy

# O deploy específico:
firebase deploy --only hosting        # Solo frontend
firebase deploy --only functions      # Solo Cloud Functions
firebase deploy --only firestore:rules # Solo reglas
```

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
