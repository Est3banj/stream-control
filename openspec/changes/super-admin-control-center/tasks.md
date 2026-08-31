# Tareas de Implementación: Super Admin Control Center 2.0

**Identificador:** `super-admin-control-center`  
**Estado:** Completado (SDD Phase: Completed)  

---

## Fase 1: Aislamiento de Navegación, Rutas y Control de Acceso

- [x] **1.1** Actualizar `src/components/Layout.tsx`:
  - Modificar el arreglo `navItems` cuando `user?.rol === 'admin'`.
  - Incluir exclusivamente: `Panel Ejecutivo` (`/`), `Directorio & CRM Usuarios` (`/usuarios`), `Suscripciones & Cobranzas` (`/admin/suscripciones`), `Planes & Cuotas` (`/admin/planes`), `Telegram` (`/telegram`), `Ajustes` (`/ajustes`).
  - Remover de la lista del admin: `/cuentas`, `/mayoristas`, `/consulta-codigos`.
  - Asegurar que el logo y estilos Dark SaaS mantengan la estética consistente.
  - *Commit:* `feat(navigation): isolate super admin navigation menu from retail tabs`

- [x] **1.2** Actualizar `src/App.tsx` y `src/components/Auth/PrivateRoute.tsx`:
  - Restringir las rutas minoristas `/cuentas`, `/mayoristas`, `/consulta-codigos`, `/ventas`, `/reportes`, `/gestion-clientes` a `roles={['usuario']}`.
  - Configurar redirección automática a `/` cuando un usuario con rol `admin` intente acceder a rutas de retail.
  - Configurar `/` para que cargue `AdminDashboard` cuando `user?.rol === 'admin'` o delegar dentro del componente raíz.
  - *Commit:* `feat(routing): enforce strict role-based route isolation for super admin`

---

## Fase 2: Dashboard Ejecutivo SaaS y Motor Financiero (MRR/ARR)

- [x] **2.1** Crear hook `src/hooks/useAdminMetrics.ts`:
  - Implementar cálculo de MRR (Monthly Recurring Revenue con normalización por periodicidad de plan).
  - Implementar cálculo de ARR (Annual Run Rate = MRR * 12).
  - Calcular total de tenants registrados vs activos pagados.
  - Calcular ARPU (Average Revenue Per User).
  - Filtrar suscripciones en riesgo (vencen en $\le 7$ días) y vencidas sin renovar.
  - Generar serie histórica mensual para gráficos de facturación.
  - *Commit:* `feat(admin-metrics): implement saas financial metrics calculation hook`

- [x] **2.2** Crear vista `src/pages/AdminDashboard.tsx`:
  - Diseñar cuadrícula de tarjetas KPI Dark SaaS (MRR, ARR, Tenants Activos, Suscripciones en Riesgo) con iconos en contenedores de resplandor neón.
  - Integrar gráfico de área de Recharts Dark con gradiente para crecimiento mensual de ingresos.
  - Integrar gráfico de dona de Recharts Dark para distribución de suscriptores por tipo de plan.
  - Implementar sección "Action Center (Cobranza Inmediata)" con listado de próximos vencimientos y botón 1-Click WhatsApp pre-rellenado con plantilla dinámica.
  - *Commit:* `feat(admin-dashboard): build executive saas dashboard with dark recharts and whatsapp billing`

- [x] **2.3** Conectar `AdminDashboard.tsx` en `src/pages/Dashboard.tsx` o `App.tsx`:
  - Asegurar que cuando el Super Admin ingrese a `/`, visualice de forma transparente el nuevo `AdminDashboard`.
  - *Commit:* `feat(dashboard): switch to admindashboard view for super admin users`

---

## Fase 3: Centro de Control de Tenants y Telemetría de Uso

- [x] **3.1** Crear componente `src/components/Admin/UsuarioDrawer.tsx` / `UserTelemetryDrawer.tsx`:
  - Panel deslizante lateral (*slide-over drawer*) con overlay blur y animaciones Dark SaaS.
  - Implementar consultas bajo demanda a Firestore (`clientes`, `cuentas`, `ventas` por `usuarioId`).
  - Mostrar tarjetas de consumo: Total Clientes Gestionados, Total Cuentas Vinculadas, Volumen Económico Transaccionado.
  - Mostrar tarjeta de suscripción activa con barra de progreso de vigencia.
  - Implementar barra de soporte rápido: Extender +7/+15/+30 días (con actualización en Firestore), Cambiar Plan, Reset de Contraseña y WhatsApp directo.
  - *Commit:* `feat(telemetry): create user telemetry drawer with on-demand firestore metrics`

- [x] **3.2** Refactorizar y potenciar `src/pages/Usuarios.tsx`:
  - Implementar barra de búsqueda reactiva por nombre, email o UID.
  - Agregar filtros por plan (Starter, Pro, Enterprise, Sin suscripción), estado (Activo, Inactivo) y verificación de correo.
  - Integrar paginación con `Paginador.tsx`.
  - Integrar trigger para abrir el `UsuarioDrawer` al hacer clic sobre cualquier usuario.
  - *Commit:* `feat(usuarios): upgrade users view to enterprise tenant control center with filters and pagination`

---

## Fase 4: Asistente de Suscripciones y Cobranzas Proactivas

- [x] **4.1** Actualizar `src/pages/AdminSuscripciones.tsx`:
  - Añadir selector de cohortes de vencimiento: `Todas las Cohortes` | `🚨 Próximos a Vencer (≤3d)` | `⚠️ Esta Semana (≤7d)` | `⏳ En Gracia / Vencidos` | `✅ Activas al Día`.
  - Implementar botón 1-click de cobro por WhatsApp con mensaje pre-rellenado.
  - Añadir botón de registro de pago rápido y renovación de ciclo.
  - *Commit:* `feat(admin-suscripciones): add expiration cohorts and whatsapp billing template manager`

---

## Fase 5: Sistema de Anuncios y Alertas Globales (Broadcast Banner)

- [x] **5.1** Crear hook `src/hooks/useBroadcastBanner.ts`:
  - Escuchar en tiempo real el documento `config/broadcast` y `configuracion/anuncioGlobal` de Firestore.
  - Proveer funciones `updateBroadcast` y `clearBroadcast`.
  - *Commit:* `feat(broadcast): create broadcast banner realtime synchronization hook`

- [x] **5.2** Crear componente `src/components/BroadcastBanner.tsx`:
  - Renderizar banner superior estilizado con Tailwind Dark SaaS según el tipo (`info`, `warning`, `critical`).
  - *Commit:* `feat(broadcast-ui): implement global broadcast banner component`

- [x] **5.3** Integrar `BroadcastBanner` en `src/components/Layout.tsx` y panel de control en `AdminDashboard.tsx`:
  - Mostrar el banner a todos los usuarios cuando esté activo.
  - Agregar modal de control en el Dashboard del Super Admin para publicar o desactivar alertas con un clic.
  - *Commit:* `feat(broadcast): integrate global alert banner in layout and admin control panel`

---

## Fase 6: Pruebas Automatizadas, Verificación de Tipos y QA

- [x] **6.1** Crear pruebas unitarias:
  - `src/hooks/useAdminMetrics.test.ts`: Validar cálculos de MRR, ARR, ARPU y cohortes de vencimiento.
  - `src/pages/AdminDashboard.test.tsx`: Validar renderizado de KPIs y botones de WhatsApp.
  - `src/components/Admin/UsuarioDrawer.test.tsx`: Validar consultas de telemetría y acciones de extensión de días.
  - `src/components/BroadcastBanner.test.tsx`: Validar banner global y cierre.
  - *Commit:* `test(admin): add unit test suite for admin dashboard, metrics and telemetry drawer`

- [x] **6.2** Verificación de compilación y pruebas:
  - Ejecutar `npm run typecheck` (`tsc --noEmit`) asegurando cero errores.
  - Ejecutar `npm test` (`vitest run`) garantizando que todos los tests pasen exitosamente.
  - *Commit:* `chore(qa): verify full test suite pass and zero typescript compilation errors`
