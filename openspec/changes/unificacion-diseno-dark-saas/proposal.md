# Propuesta: Unificación del Sistema de Diseño Dark SaaS en toda la plataforma StreamControl Pro

**Identificador:** `unificacion-diseno-dark-saas`  
**Fecha:** 2026-08-31  
**Autor:** Senior Architect  
**Estado:** Propuesta Aprobada para SDD  

---

## 1. Resumen Ejecutivo y Diagnóstico Arquitectónico

### El Problema: Ruptura Visual Post-Autenticación
Actualmente, StreamControl Pro presenta una dicotomía estética y de experiencia de usuario (*UX*) severa:
1. **Flujo de Autenticación Modernizado:** Los módulos de acceso y verificación (`Login`, `Register`, `VerificarEmail`, `AuthLayout`) cuentan con una estética Dark SaaS premium (`slate-950`, ambient radial glows, tarjetas translúcidas `slate-900/80`, bordes sutiles y acentos cian/índigo).
2. **Plataforma Operativa Heredada:** Al iniciar sesión, el usuario es transportado a una interfaz *Light Theme* tradicional (`from-indigo-50 via-white to-cyan-50`, tarjetas con fondos blancos sólidos o transparencias lechosas, sombras pesadas `rgba(31, 38, 135, ...)`, textos negros sobre fondos blancos y bordes grises claros).

Esta inconsistencia genera:
- **Fatiga visual inmediata** al pasar de una pantalla oscura elegante a un lienzo blanco brillante.
- **Percepción de producto fragmentado** o en etapa beta/incompleta.
- **Dificultad de mantenimiento:** Coexisten clases CSS utilitarias en conflicto (ej. `.glass` con `rgba(255,255,255,0.7)` y variables CSS desactualizadas en `src/index.css`).

### La Solución: Unificación Sistemática Dark SaaS
La presente iniciativa implementa la migración integral, profunda y sin fisuras de **toda la plataforma StreamControl Pro** hacia un **Sistema de Diseño Dark SaaS de Grado Enterprise**, asegurando:
- **Tokens de Diseño Coherentes:** Superficies semánticas escalonadas (`slate-950` canvas, `slate-900/75` tarjetas base, `slate-800/60` elementos elevados/modales, `slate-800/80` bordes).
- **Consistencia en Componentes Compartidos:** Badges de plataformas translúcidos, tablas con encabezados oscuros, paginadores, dropdowns, modales con *backdrop-blur* y controles de formulario dark nativos.
- **Gráficos y Visualización Dark:** Adaptación de Recharts en el Dashboard (`CartesianGrid`, `Tooltip`, `PieChart`, `BarChart`) para fondos oscuros con contraste óptimo.
- **Cero Regresión en Lógica de Negocio:** Preservación al 100% de listeners de Firestore (`onSnapshot`), hooks personalizados (`useVentas`, `useClientes`, `useCuentas`, `useTokens`, `usePermisos`, `useMoneda`), control de accesos por roles (`admin` vs `usuario`), y compatibilidad total con la suite de pruebas unitarias (`vitest`).

---

## 2. Arquitectura del Sistema de Diseño Dark SaaS

```
+--------------------------------------------------------------------------------------------------+
|                                STREAMCONTROL PRO — DARK SAAS SHELL                               |
|                                                                                                  |
|  +--------------------------------------------------------------------------------------------+  |
|  | Ambient Radial Lights: indigo-600/10 (Top Left) | violet-600/10 (Bottom Right)             |  |
|  +--------------------------------------------------------------------------------------------+  |
|                                                                                                  |
|  +---------------------------+  +-------------------------------------------------------------+  |
|  | SIDEBAR                   |  | HEADER: Sticky blur (slate-950/80 backdrop-blur-xl)         |  |
|  | - Glass dark slate-900/90 |  | - NotificationsPanel (Dark drawer + unread badge pulse)     |  |
|  | - Border-r slate-800/80   |  | - User quick badge & Actions                                |  |
|  | - Logo with cyan glow     |  +-------------------------------------------------------------+  |
|  | - Active route:           |                                                                   |
|  |   bg-indigo-600/20        |  +-------------------------------------------------------------+  |
|  |   text-cyan-300           |  | MAIN CONTENT VIEW (Max-W-7xl, Animate-Fade-In)              |  |
|  |   border-indigo-500/30    |  |                                                             |  |
|  | - User profile summary    |  |  [ KPI Cards: bg-slate-900/75 border-slate-800/80 ]        |  |
|  | - Logout button           |  |  [ Dark Recharts / Interactive Visualizers ]                |  |
|  +---------------------------+  |  [ Data Tables: Dark headers, row hover slate-800/40 ]      |  |
|                                 |  [ Modals & Flyouts: bg-slate-900 border-slate-800 ]        |  |
|                                 +-------------------------------------------------------------+  |
+--------------------------------------------------------------------------------------------------+
```

---

## 3. Alcance Detallado de la Intervención

### 3.1 Tokens de Diseño y CSS Global (`tailwind.config.js`, `src/index.css`)
- Reemplazar estilos base de `body` (eliminar degradados claros `indigo-50 via-white to-cyan-50` y establecer `bg-slate-950 text-slate-100`).
- Redefinir variables y utilidades `.glass`, `.card`, `.btn-primary`, `.btn-secondary`, `.dark-glass`, y `.dark-table-header`.
- Configurar scrollbars oscuros con pista `bg-slate-900` y pulgar `from-indigo-600 to-violet-600`.
- Configurar estilos base de elementos de formulario (`input`, `select`, `textarea`) con fondo oscuro `bg-slate-900/80`, borde `slate-700/70` y foco `ring-indigo-500/30`.

### 3.2 Shell Principal y Navegación (`Layout.tsx`, `Sidebar`, `Header`, `NotificationsPanel`, `PWAInstallButton`)
- Estructura base en `Layout.tsx` con fondo `bg-slate-950` y luces ambientales sutiles.
- Sidebar translúcido en `bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/80`.
- Indicadores de navegación activos con estilo `bg-indigo-600/20 text-cyan-300 border border-indigo-500/30 shadow-lg shadow-indigo-950/50`.
- Header sticky con efecto de vidrio oscuro (`bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80`).
- Panel de notificaciones adaptado al modo oscuro con estados de mora y vencimiento contrastados.

### 3.3 Primitivas y Componentes Compartidos
- **`PlataformaBadge.tsx`:** Badges translúcidos oscuros con bordes sutiles y texto de alto contraste para cada servicio (Netflix, Disney+, Max, Prime Video, Spotify, Crunchyroll, ChatGPT, MagisTV, Win Sports+, Canva, etc.).
- **`Paginador.tsx`:** Controles de paginación oscuros con botones activos en `indigo-600` y números de página legibles.
- **`DropdownMenu.tsx`:** Menú desplegable con fondo `bg-slate-900`, borde `slate-800`, sombras profundas y opciones de acción y peligro (`text-rose-400 hover:bg-rose-950/40`).
- **`TicketModal.tsx` & `UpgradeModal.tsx`:** Modales oscuros con backdrop `bg-black/75 backdrop-blur-md`, tarjetas de plan en `slate-900/90`, badges "Recomendado" y tabla comparativa en modo oscuro.
- **`FeatureBlocked.tsx`, `CasoSelector.tsx`, `CodeResult.tsx`, `CuentaDetail.tsx`, `CuentaForm.tsx`, `SelectorCuenta.tsx`, `ConfigurarIMAP.tsx`, `PlanForm.tsx`, `SuscripcionCard.tsx`:** Homogeneización al estándar Dark SaaS.

### 3.4 Vistas Operativas Principales
- **`Dashboard.tsx`:** Tarjetas de métricas con iconos en gradientes neón, gráficos de Recharts con tooltip oscuro (`bg-slate-900 border-slate-700 text-slate-100`) y grillas en `#334155`.
- **`GestionClientes.tsx`:** Barra de búsqueda, chips de filtro (Activos, Inactivos, Todos), tarjetas resumen admin, tabla de clientes dark, modales de edición, historial, cobro, link de códigos, consulta y liberación de perfil.
- **`GestionCuentas.tsx`:** Filtros por proveedor y estado, métricas de cuentas, tabla dark con badges de perfiles, modales de asignación y renovación.
- **`Ventas.tsx` / `VentasForm.tsx`:** Formulario de venta simple y combinada con tabs oscuros, selector de cuentas, filas dinámicas de perfiles y cálculo de utilidades.

### 3.5 Vistas Especializadas y Administrativas
- **`Reportes.tsx`:** Filtros por fecha y subdistribuidor, KPI cards, tabla de reportes y exportación a Excel.
- **`VentasMayoristas.tsx`:** Tab de generación de links mayoristas y tabla de tokens activos con revocación/reactivación.
- **`ConsultaCodigos.tsx`:** Selector de cuentas y casos con visor interactivo de código OTP/enlace temporal.
- **`Usuarios.tsx`:** Formulario de registro de operadores, tabla de usuarios con badges de verificación (`emailVerified`) y modal de creación de suscripción.
- **`AdminPlanes.tsx` & `AdminSuscripciones.tsx`:** Configuración de WhatsApp comercial, gestión de planes y tarjetas de suscripción.
- **`Ajustes.tsx` & `TelegramConfig.tsx`:** Gestión de perfil, moneda por defecto, cambio de credenciales y vinculación de bot de Telegram con código de verificación.

### 3.6 Estrategia de Calidad y Cero Regresión
- Verificación exhaustiva de compilación TypeScript (`npm run typecheck`).
- Ejecución de la suite completa de pruebas unitarias (`npm test` con Vitest) asegurando que el 100% de los 140 tests sigan pasando.

---

## 4. Análisis de Riesgos y Mitigaciones

| Riesgo Identificado | Impacto | Mitigación |
| :--- | :--- | :--- |
| **Contraste insuficiente en textos secundarios** | Medio (Accesibilidad) | Aplicar la escala estricta: Headers (`text-white`), Primario (`text-slate-100`), Secundario (`text-slate-300`), Muted (`text-slate-400`/`text-slate-500`). Ratio WCAG AA > 4.5:1. |
| **Ruptura de selectores en tests existentes** | Medio (Falsos negativos) | Preservar clases funcionales y selectores de rol/aria/texto (`getByRole('dialog')`, `getByText('...')`, `className.toContain('text-red-600')`). |
| **Pérdida de legibilidad en gráficos Recharts** | Alto (UX Dashboard) | Configurar explícitamente `stroke`, `fill`, `tick` y componentes personalizados de `Tooltip` con fondo oscuro y texto claro. |
| **Regresión en listeners Firestore en modales/vistas** | Alto (Integridad de datos) | No alterar dependencias de `useEffect`, ni mutar estados de Firestore o hooks; intervenir únicamente la capa de presentación JSX y clases CSS. |
