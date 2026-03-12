# 🚀 StreamControl: Sistema de Gestión de Suscripciones

StreamControl es una plataforma premium diseñada para la gestión eficiente de negocios de reventa de servicios de streaming. Permite el control total de clientes, ventas, vencimientos y reportes financieros con un enfoque en la automatización y la experiencia de usuario.

---

## 🛠️ Stack Tecnológico

El proyecto utiliza tecnologías modernas de alto rendimiento:

- **Frontend**: [React.js](https://reactjs.org/) (v18) con [Vite](https://vitejs.dev/) para un desarrollo ultrarrápido.
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/) para un diseño responsivo y moderno.
- **Animaciones**: [Framer Motion](https://www.framer.com/motion/) para micro-interacciones fluidas.
- **Backend/Base de Datos**: [Firebase](https://firebase.google.com/) (Firestore para tiempo real, Auth para seguridad).
- **Visualización**: [Recharts](https://recharts.org/) para analíticas visuales.
- **PWA**: Soporte nativo para instalación como aplicación de escritorio y móvil.

---

## 📂 Estructura del Proyecto

```text
streamcontrol_streamlined/
├── src/
│   ├── components/       # Componentes reutilizables (Layout, Auth, Forms)
│   ├── contexts/         # Estado global (Autenticación y Sesión)
│   ├── hooks/            # Lógica de negocio extraída (Vencimientos, Notificaciones)
│   ├── pages/            # Vistas principales (Dashboard, Ventas, Reportes, Clientes)
│   ├── firebase.js       # Configuración e inicialización de servicios
│   └── main.jsx          # Punto de entrada de la aplicación
├── firestore.rules       # Seguridad y reglas de acceso a datos
├── firebase.json         # Configuración de Hosting y Firestore
├── tailwind.config.js    # Definición del sistema de diseño
└── vite.config.js        # Configuración del empaquetador
```

---

## 🧠 Lógica de Negocio y Flujo de Datos

### Propósito Principal
Centralizar el ciclo de vida de una suscripción: desde la venta inicial hasta el seguimiento de renovaciones y el cálculo de utilidades.

### Flujo de Información
1. **Autenticación**: El sistema utiliza Firebase Auth con roles persistidos en Firestore (`admin` vs `usuario`).
2. **Registro de Ventas**: Al vender un servicio, se crea un registro en `ventas` y se actualiza/crea el registro maestro en `clientes`.
3. **Control de Vencimientos**: Un Hook personalizado (`useClientesConNotificaciones`) monitorea en tiempo real los días restantes de cada cliente.
4. **Seguridad**: Las `firestore.rules` garantizan que los usuarios solo vean sus propios clientes, mientras que los administradores mantienen visibilidad global.

---

## ⚙️ Configuración y Despliegue

### Requisitos Previos
- Node.js (v18+)
- Una cuenta en Firebase Console.

### Pasos para Levantar el Proyecto

1. **Instalar Dependencias**:
   ```bash
   npm install
   ```

2. **Configurar Variables de Entorno**:
   Crea un archivo `.env` en la raíz (basado en `src/firebase.js`):
   ```env
   VITE_FIREBASE_API_KEY=tu_api_key
   VITE_FIREBASE_AUTH_DOMAIN=tu_dominio
   VITE_FIREBASE_PROJECT_ID=tu_project_id
   # ... ver firebase.js para la lista completa
   ```

3. **Ejecutar en Desarrollo**:
   ```bash
   npm run dev
   ```

---

## 📑 Componentes Críticos

- **`AuthContext.jsx`**: Gestiona la sesión y protege las rutas según el rol.
- **`useClientesConNotificaciones.js`**: El motor de alertas del sistema.
- **`VentasForm.jsx`**: Lógica compleja de autocompletado y validación cruzada.
- **`firestore.rules`**: La columna vertebral de la privacidad y el cumplimiento de datos.

