# Tareas: Unificación del Sistema de Diseño Dark SaaS en toda la plataforma StreamControl Pro

**Identificador:** `unificacion-diseno-dark-saas`  
**Estado:** Aplicación Completada (SDD Phase: Apply)  

---

## Fase 1: Fundaciones, Tokens de Diseño y CSS Global

- [x] **1.1** Actualizar `tailwind.config.js` y `src/index.css`:
  - Definir tokens de diseño semánticos para superficies (`slate-950` canvas, `slate-900/75` tarjetas, `slate-800/80` bordes y modales).
  - Actualizar estilos base de `body`, eliminar degradados claros heredados (`from-indigo-50 via-white to-cyan-50`) y establecer fondo oscuro `bg-slate-950` con texto `text-slate-100`.
  - Redefinir utilidades `.glass`, `.glass-strong`, `.card`, `.btn-primary`, `.btn-secondary` para modo oscuro.
  - Configurar scrollbar personalizado oscuro con pista `bg-slate-900` y pulgar en gradiente `indigo-600` a `violet-600`.
  - Configurar estilos base de elementos de formulario (`input`, `select`, `textarea`) con fondo `bg-slate-900/80`, borde `slate-700` y foco `ring-indigo-500/30`.
  - Mantener reglas de autocompletado para navegadores WebKit en fondos oscuros.
  - *Commit:* `feat(design-tokens): implement dark saas design tokens and global css utilities`

---

## Fase 2: Shell Principal y Navegación

- [x] **2.1** Actualizar `src/components/Layout.tsx`:
  - Aplicar contenedor principal en `bg-slate-950 text-slate-100` con luces radiales ambientales (`indigo-600/10` y `violet-600/10`).
  - Rediseñar Sidebar con fondo `bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/80` y logo con resplandor sutil.
  - Actualizar enlaces de navegación activos con estilo `bg-indigo-600/20 text-cyan-300 border border-indigo-500/30`.
  - Ajustar bloque de información de usuario y botón de cierre de sesión en la parte inferior del sidebar.
  - Rediseñar Header sticky con `bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80`.
  - *Commit:* `feat(layout): apply dark saas theme to main layout, sidebar and header`

- [x] **2.2** Actualizar `src/components/NotificationsPanel.tsx`:
  - Adaptar el botón y badge pulsante a la paleta oscura.
  - Rediseñar el dropdown desplegable en `bg-slate-900 border border-slate-800 shadow-2xl`.
  - Actualizar las tarjetas de notificación para estados vencido, mora y por vencer con badges contrastados.
  - *Commit:* `feat(notifications): modernize notification flyout panel for dark saas`

- [x] **2.3** Actualizar `src/components/PWAInstallButton.tsx`:
  - Adaptar el banner flotante y botón de instalación en sidebar a la paleta `slate-900/slate-800` con botón primario neón.
  - *Commit:* `feat(pwa-ui): update pwa installation prompt and banner for dark theme`

---

## Fase 3: Primitivas Compartidas y Arquitectura de Modales

- [x] **3.1** Actualizar `src/components/PlataformaBadge.tsx` y validar `src/components/PlataformaBadge.test.tsx`:
  - Definir badges translúcidos con fondos oscuros (`bg-red-950/50 text-red-400 border-red-800/50`, etc.) para todas las plataformas.
  - Preservar compatibilidad con los selectores de prueba existentes.
  - *Commit:* `feat(ui-primitives): modernize platform badges for dark mode without test regressions`

- [x] **3.2** Actualizar `src/components/Paginador.tsx`:
  - Adaptar el contador de registros, selector de items por página y botones numéricos de página con fondo `slate-900/slate-800` y activo en `indigo-600`.
  - *Commit:* `feat(ui-primitives): adapt paginator component for dark theme`

- [x] **3.3** Actualizar `src/components/DropdownMenu.tsx`:
  - Adaptar el menú contextual con fondo `bg-slate-900 border border-slate-800` y soporte para opciones de peligro en rojo neón.
  - *Commit:* `feat(ui-primitives): apply dark theme to contextual dropdown menu`

- [x] **3.4** Actualizar `src/components/TicketModal.tsx`:
  - Rediseñar el diálogo modal con backdrop `bg-black/75 backdrop-blur-md` y contenedor `bg-slate-900 border-slate-800`.
  - Adaptar las tarjetas de servicio y filas de credenciales monoespaciadas a la paleta oscura.
  - *Commit:* `feat(ui-modals): modernize ticket modal dialog with dark glassmorphism`

- [x] **3.5** Actualizar `src/components/UpgradeModal.tsx` y validar `src/components/UpgradeModal.test.tsx`:
  - Rediseñar el modal con backdrop oscuro, selector de periodos en `bg-slate-950` y tarjetas de planes en `slate-900`.
  - Resaltar el plan recomendado (Professional) con borde `indigo-500` y sombra profunda.
  - Adaptar la tabla comparativa completa para fondos oscuros.
  - *Commit:* `feat(ui-modals): transform upgrade modal and comparison table to dark saas design`

- [x] **3.6** Actualizar `src/components/FeatureBlocked.tsx`, `src/components/CasoSelector.tsx`, y `src/components/CodeResult.tsx`:
  - Homogeneizar los componentes de funcionalidad bloqueada y consulta de códigos con la paleta `slate-900/slate-800`.
  - *Commit:* `feat(ui-primitives): update feature blocked and code result components for dark mode`

---

## Fase 4: Vistas Operativas Principales

- [x] **4.1** Actualizar `src/pages/Dashboard.tsx`:
  - Rediseñar tarjetas de métricas ejecutivas con gradientes en iconos y tipografía `text-white` / `text-slate-400`.
  - Configurar Recharts con grilla `#334155`, ejes en `#94a3b8` y Tooltip oscuro personalizado.
  - Adaptar tablas de clientes y plataformas destacadas con encabezados oscuros.
  - *Commit:* `feat(dashboard): implement dark saas kpi cards and dark recharts visualizations`

- [x] **4.2** Actualizar `src/pages/GestionClientes.tsx`:
  - Rediseñar barra de filtros y búsqueda en `bg-slate-900/80 border-slate-800`.
  - Aplicar estilos dark a la tabla de clientes (encabezados, filas con hover `slate-800/40`, badges de días restantes y deuda).
  - Adaptar todos los modales de la vista (Editar Cliente, Historial de Ventas, Cobrar, Link de Códigos, Consulta Interna, Revocar Token y Liberar Perfil).
  - *Commit:* `feat(gestion-clientes): apply dark saas styling to clients management table and modals`

- [x] **4.3** Actualizar `src/pages/GestionCuentas.tsx` y subcomponentes (`CuentaDetail.tsx`, `CuentaForm.tsx`, `SelectorCuenta.tsx`, `ConfigurarIMAP.tsx`):
  - Rediseñar slider de filtros por proveedor y chips de estado.
  - Aplicar estilos dark a la tabla de cuentas y badges de perfiles.
  - Adaptar modales de registro de cuenta, detalle, asignación de perfiles y configuración IMAP.
  - *Commit:* `feat(gestion-cuentas): modernize accounts management and account subcomponents`

- [x] **4.4** Actualizar `src/pages/Ventas.tsx` y `src/components/VentasForm.tsx`:
  - Rediseñar formulario de ventas con soporte para venta simple y venta combinada con pestañas oscuras.
  - Adaptar selector de cuentas, inputs dinámicos de perfiles y tarjeta de resumen financiero (utilidad y precios).
  - *Commit:* `feat(ventas): update sales registration form and combined service cards to dark saas`

---

## Fase 5: Vistas Especializadas y Administrativas

- [x] **5.1** Actualizar `src/pages/Reportes.tsx`:
  - Adaptar selectores de rango de fecha, chips de filtro de subdistribuidor, tarjetas de balance y tabla de reportes a la paleta oscura.
  - *Commit:* `feat(reportes): adapt reports view and financial filters for dark theme`

- [x] **5.2** Actualizar `src/pages/VentasMayoristas.tsx`:
  - Adaptar tabs de venta mayorista y gestión de links activos, tarjetas de costos y tabla de tokens con acciones de revocar/reactivar.
  - *Commit:* `feat(mayoristas): modernize wholesale sales view and active tokens table`

- [x] **5.3** Actualizar `src/pages/ConsultaCodigos.tsx`:
  - Adaptar selector de cuentas y casos con visor interactivo de código OTP/enlace temporal.
  - *Commit:* `feat(consulta-codigos): apply dark theme to code lookup interface`

- [x] **5.4** Actualizar `src/pages/Usuarios.tsx`:
  - Adaptar formulario de registro de operadores, tabla de usuarios con badges de verificación de email y modal de suscripción.
  - *Commit:* `feat(usuarios): modernize user management view with dark saas style`

- [x] **5.5** Actualizar `src/pages/AdminPlanes.tsx` y `src/components/PlanForm.tsx`:
  - Adaptar configuración de WhatsApp comercial, grilla de planes activos y modal de creación/edición de planes.
  - *Commit:* `feat(admin-planes): update admin plans view and plan editor modal`

- [x] **5.6** Actualizar `src/pages/AdminSuscripciones.tsx` y `src/components/SuscripcionCard.tsx`:
  - Adaptar filtros de suscripciones, tarjetas individuales con badges de estado y pago, y modal de nueva suscripción.
  - *Commit:* `feat(admin-suscripciones): modernize subscriptions administration view`

- [x] **5.7** Actualizar `src/pages/Ajustes.tsx`, `src/pages/TelegramConfig.tsx`, `src/pages/ConsultaPublica.tsx`, `src/pages/VerificarEmailLink.tsx` y `src/components/ErrorBoundary.tsx`:
  - Adaptar configuración de perfil, selector de moneda, modales de cambio de contraseña/email, vinculación de bot de Telegram y páginas públicas independientes.
  - *Commit:* `feat(settings-misc): apply dark saas theme to settings, telegram and public pages`

---

## Fase 6: Verificación, Pruebas Automatizadas y QA

- [x] **6.1** Ejecutar verificación de tipos TypeScript:
  - Ejecutar `npm run typecheck` (`tsc --noEmit` en raíz y api) y asegurar cero errores de compilación.
- [x] **6.2** Ejecutar la suite completa de pruebas unitarias:
  - Ejecutar `npm test` (`vitest run`) y verificar que el 100% de los 19 archivos de test y 140+ casos de prueba pasen satisfactoriamente.
- [x] **6.3** Inspección visual y validación de contrastes WCAG AA en todas las vistas y modales clave.

