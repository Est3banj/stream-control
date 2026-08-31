# Exploración: Super Admin Control Center 2.0 — Transformación a Gestión SaaS Pura

**Identificador:** `super-admin-control-center`  
**Fecha:** 2026-08-31  
**Autor:** Senior Architect  
**Estado:** Exploración completada  

---

## 1. Contexto y Diagnóstico Arquitectónico

StreamControl Pro ha evolucionado de una herramienta operativa de reventa de streaming a una **plataforma SaaS multi-tenant completa**. En esta fase de maduración, la cuenta de **Super Administrador** (`estebanjurado2005@gmail.com` con `rol: 'admin'`) debe operar exclusivamente como el **Comandante del Negocio SaaS**, supervisando métricas financieras (MRR, ARR, ARPU), ciclo de vida de tenants/operadores, cobranza de suscripciones y salud del sistema.

### 1.1 El Problema: Acoplamiento de Vistas Minoristas con Administración SaaS
Actualmente, la interfaz del Super Administrador sufre de un grave **acoplamiento funcional y de experiencia de usuario**:
1. **Contaminación de Rutas Minoristas:** El sidebar del administrador muestra accesos directos a `/cuentas`, `/mayoristas` y `/consulta-codigos`. Estas rutas corresponden a la operación de venta minorista que realizan los tenants/vendedores individuales con sus propios clientes finales, generando ruido visual innecesario y confusión sobre el alcance de la administración.
2. **Dashboard Híbrido Inadecuado:** El componente `src/pages/Dashboard.tsx` intenta satisfacer tanto a operadores minoristas como al administrador global mediante condicionales dispersos (`isAdmin ? ... : ...`). No calcula métricas financieras SaaS críticas como **MRR (Monthly Recurring Revenue)**, **ARR (Annual Run Rate)**, **tasa de renovación**, ni distribución de clientes por plan.
3. **Gestión de Usuarios sin Telemetría:** La vista actual `src/pages/Usuarios.tsx` se limita a un formulario de creación básico y una tabla simple. Carece de capacidades de búsqueda en tiempo real, filtros por estado/plan/verificación, paginación, y sobre todo, **telemetría de uso del tenant** (cuántos clientes tiene cada tenant, cuántas cuentas gestiona, volumen de ventas y consumo del sistema).
4. **Cobranza y Asistente de Renovación Manual:** La gestión de suscripciones en `src/pages/AdminSuscripciones.tsx` no cuenta con asistentes de cobranza automatizados por WhatsApp, filtrado por cohortes de vencimiento (vence hoy, en 3 días, en 7 días, vencidas en mora) ni plantillas dinámicas de recordatorio.
5. **Falta de Capacidad de Broadcast/Alertas Globales:** El Super Admin no tiene un canal centralizado para publicar alertas operativas o anuncios de mantenimiento visibles para todos los usuarios de la plataforma en tiempo real.

---

## 2. Diagnóstico Técnico de Componentes Existentes

### 2.1 Navegación y Control de Acceso (`src/components/Layout.tsx` & `src/App.tsx`)
- **Estado Actual:**
  - `Layout.tsx` evalúa `user?.rol === 'admin'` para definir `navItems`, pero incluye `/cuentas`, `/mayoristas`, `/consulta-codigos`.
  - `App.tsx` protege rutas mediante `<PrivateRoute roles={['admin', 'usuario']}>` en `/cuentas`, `/mayoristas`, `/consulta-codigos`, permitiendo que el admin navegue a zonas de inventario minorista.
- **Oportunidad de Refactor:**
  - Aislar 100% las rutas minoristas para `roles={['usuario']}`.
  - El Super Admin solo tendrá acceso a: `Dashboard` (`/`), `Usuarios / Tenants` (`/usuarios`), `Suscripciones` (`/admin/suscripciones`), `Planes` (`/admin/planes`), `Telegram` (`/telegram`), `Ajustes` (`/ajustes`).
  - Redireccionar al admin a `/` si intenta acceder directamente a una ruta de retail.

### 2.2 Dashboard Ejecutivo (`src/pages/Dashboard.tsx` vs `src/pages/AdminDashboard.tsx`)
- **Estado Actual:**
  - `Dashboard.tsx` mezcla lógica de `useVentas` (ventas minoristas de streaming) con conteo de usuarios y suma simple de suscripciones.
  - Al no haber ventas directas del admin en el negocio minorista, las tarjetas de ingresos y gráficos de vendedores/clientes muestran datos vacíos o inconsistentes.
- **Oportunidad de Refactor:**
  - Crear un componente dedicado `src/pages/AdminDashboard.tsx`.
  - En `Dashboard.tsx` (o mediante enrutador de nivel superior en `/`), si `user.rol === 'admin'`, renderizar directamente `AdminDashboard`.
  - Implementar cálculo reactivo de:
    - **MRR (Ingresos Recurrentes Mensuales):** Normalización de suscripciones activas según periodicidad (mensual = 100%, trimestral = precio/3, semestral = precio/6, anual = precio/12).
    - **ARR (Tasa de Ejecución Anual):** MRR * 12.
    - **Total Tenants Activos vs Registrados.**
    - **ARPU (Ingreso Promedio por Tenant Activo).**
    - **Gráfico de Evolución de Ingresos Recurrentes (Recharts AreaChart / BarChart Dark).**
    - **Distribución de Suscriptores por Plan (Recharts PieChart / Donut Dark).**
    - **Feed de Vencimientos Inminentes con Asistente 1-Click WhatsApp:** Lista de usuarios que vencen en $\le 7$ días o están vencidos, con botón de WhatsApp directo que abre chat con mensaje pre-rellenado.

### 2.3 Centro de Control de Tenants (`src/pages/Usuarios.tsx`)
- **Estado Actual:**
  - Lectura en tiempo real de `collection(db, 'usuarios')`.
  - Sin búsqueda, sin filtros de planes, sin paginación.
  - Acciones limitadas a cambiar estado y abrir modal simple de plan.
- **Oportunidad de Refactor:**
  - **Filtros Avanzados:** Búsqueda textual por nombre/correo/ID, selector de estado (Activo, Inactivo), filtro por plan (Starter, Pro, Enterprise, Sin suscripción), filtro por verificación de email (`emailVerified`).
  - **Paginación Integrada:** Paginador reutilizable para escalar a cientos de operadores.
  - **User Telemetry Drawer (Panel Lateral de Telemetría):** Al hacer clic en un tenant, desplegar un drawer lateral que consulte y agregue en tiempo real:
    - Total de clientes registrados en `clientes` con `usuarioId == uid`.
    - Total de cuentas de streaming creadas en `cuentas` con `usuarioId == uid`.
    - Total de ventas y volumen de transacciones de ese tenant.
    - Historial de suscripciones y transacciones de ese tenant.
    - Fecha de registro y último estado de actividad.
  - **Acciones Rápidas de Soporte:**
    - Botón "Extender suscripción" (+7 días, +15 días, +30 días).
    - Botón "Cambiar Plan".
    - Botón "Enviar Reset de Contraseña".
    - Botón "Soporte WhatsApp" directo al teléfono del usuario si está registrado o enlace de contacto.

### 2.4 Asistente de Suscripciones y Cobranzas (`src/pages/AdminSuscripciones.tsx`)
- **Estado Actual:**
  - Permite filtrar por estado y pago, crear y marcar pagada.
  - No cuenta con visualización de cohortes de urgencia ni plantillas dinámicas de recordatorio.
- **Oportunidad de Refactor:**
  - Filtros por **Cohortes de Vencimiento**: Vencen en $\le 3$ días, Vencen en $\le 7$ días, Vencidas sin renovar, Activas al día.
  - **Plantillas de Cobro WhatsApp Inteligentes**:
    1. *Aviso Preventivo:* "Hola [Nombre], tu suscripción a StreamControl Pro ([Plan]) vence en [X] días ([Fecha]). Renová a tiempo para evitar interrupciones."
    2. *Aviso de Vencimiento:* "Hola [Nombre], tu suscripción [Plan] vence hoy. Hacé tu pago para continuar disfrutando del servicio."
    3. *Aviso de Suspensión:* "Hola [Nombre], tu suscripción se encuentra vencida. Reactivala hoy mismo."
  - Modal de renovación en 1 clic que precarga las fechas correctas sumando el período seleccionado a la fecha actual o fecha fin previa.

### 2.5 Sistema de Broadcast y Anuncios Globales
- **Nueva Capacidad:**
  - Documento Firestore `config/broadcast` con estructura:
    `{ active: boolean, message: string, type: 'info' | 'warning' | 'critical', updatedAt: Timestamp, author: string }`.
  - Renderizado automático en `src/components/Layout.tsx` en la parte superior del contenido para todos los usuarios.
  - Panel de control de broadcast en el Dashboard / Ajustes del Super Admin para activar, editar y apagar anuncios al instante.

---

## 3. Matriz de Separación de Responsabilidades (SaaS Admin vs Tenant)

| Capacidad / Módulo | Super Admin (`rol: 'admin'`) | Tenant / Operador (`rol: 'usuario'`) |
| :--- | :--- | :--- |
| **Dashboard** | **Executive SaaS Dashboard:** MRR, ARR, ARPU, Crecimiento, Distribución de Planes, Asistente de Cobro. | **Retail Dashboard:** Ventas de perfiles, utilidad del día/mes, clientes morosos, cuentas por renovar. |
| **Gestión de Clientes** | Inaccesible (Aislado a nivel tenant). | Gestión completa de clientes finales de streaming. |
| **Gestión de Cuentas / Cuentas Madre** | Inaccesible (Aislado a nivel tenant). | Gestión de cuentas de Netflix, Disney+, Max, etc. |
| **Ventas / Reportes Retail** | Inaccesible. | Registro de ventas y balances financieros propios. |
| **Mayoristas / Consulta Códigos** | Inaccesible. | Distribución de enlaces a revendedores y consulta OTP. |
| **Gestión de Tenants / Usuarios** | **Total:** Búsqueda, filtros, telemetría de uso, cambio de plan, extensiones. | Inaccesible. |
| **Suscripciones SaaS** | **Total:** Gestión de pagos, cohortes, renovación 1-click, cobro WhatsApp. | Vista de su propia suscripción en UpgradeModal / Perfil. |
| **Catálogo de Planes SaaS** | Creación y edición de planes y características. | Lectura de catálogo para upgrades. |
| **Broadcast Banner** | Creación, activación y publicación de anuncios globales. | Visualización de anuncios activos en el header. |

---

## 4. Conclusión de la Exploración

La separación limpia de la experiencia del Super Administrador otorgará a StreamControl Pro una infraestructura de gestión SaaS de primer nivel, permitiendo al fundador escalar su negocio, monitorear ingresos en tiempo real, reducir el churn con cobranzas proactivas por WhatsApp y diagnosticar el uso de cada tenant sin interferir en las operaciones minoristas de los clientes.
