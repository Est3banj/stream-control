# Propuesta: Super Admin Control Center 2.0 — Centro de Comando SaaS Integral

**Identificador:** `super-admin-control-center`  
**Fecha:** 2026-08-31  
**Autor:** Senior Architect  
**Estado:** Propuesta Aprobada para SDD  

---

## 1. Resumen Ejecutivo

StreamControl Pro se consolida como una solución SaaS multi-tenant líder para distribuidores de servicios digitales y cuentas de streaming. Para maximizar la eficiencia en la gestión del negocio, escalar la captación de suscriptores y reducir la tasa de cancelación (*churn*), se establece una **separación arquitectónica radical e irrevocable**:

> **Decisión Arquitectónica Fundamental:**  
> La cuenta de **Super Administrador** (`estebanjurado2005@gmail.com` con `rol: 'admin'`) está **100% dedicada a la gestión de la plataforma SaaS StreamControl Pro** (usuarios/tenants, planes de suscripción, ingresos recurrentes MRR/ARR, telemetría y alertas del sistema).  
> Las operaciones de venta y reventa minorista de cuentas de streaming quedan **estrictamente aisladas en las cuentas de los tenants**. Se eliminan todas las pestañas y rutas de reventa minorista (`/cuentas`, `/mayoristas`, `/consulta-codigos`, `/ventas`, `/reportes`, `/gestion-clientes`) del entorno del Super Administrador.

Esta iniciativa transforma la experiencia administrativa en un **Centro de Comando SaaS de Grado Enterprise**, dotado de analíticas financieras avanzadas, telemetría de uso por tenant, asistentes de cobranza proactivos con integración de WhatsApp en un clic y capacidades de comunicación global (Broadcast Banner).

---

## 2. Personas y Casos de Uso (User Stories)

### 2.1 Persona: Super Administrador (Fundador / CEO SaaS)
- **Perfil:** Esteban, Administrador General de StreamControl Pro.
- **Objetivo Principal:** Monitorear la salud financiera del SaaS, gestionar el ciclo de vida de los clientes operadores (tenants), cobrar renovaciones oportunamente y brindar soporte técnico y comercial de forma ágil.
- **Dolores Actuales:**
  - Ruido visual por ver menús minoristas de streaming que no utiliza.
  - Carencia de visibilidad sobre el MRR mensual y la distribución real de ingresos por tipo de plan.
  - Imposibilidad de saber qué tan activo es un tenant (cuántos clientes o cuentas gestiona) sin inspeccionar manualmente la base de datos.
  - Fricción para contactar a usuarios próximos a vencer para cobrar sus renovaciones.

### 2.2 Historias de Usuario (User Stories)

1. **US-01: Aislamiento de Navegación y Rutas:**  
   *Como* Super Administrador,  
   *quiero* un sidebar y esquema de rutas limpio enfocado exclusivamente en la gestión del SaaS,  
   *para* concentrarme en la administración del negocio sin distracciones operativas minoristas.

2. **US-02: Dashboard Ejecutivo SaaS con MRR / ARR:**  
   *Como* Super Administrador,  
   *quiero* visualizar en tiempo real métricas clave como MRR, ARR, ARPU, total de tenants activos y distribución de suscriptores,  
   *para* evaluar el crecimiento financiero y la retención del negocio.

3. **US-03: Asistente de Cobranza y Renovaciones con 1-Click WhatsApp:**  
   *Como* Super Administrador,  
   *quiero* una bandeja de suscripciones próximas a vencer con botones de cobro directo vía WhatsApp y plantillas inteligentes,  
   *para* recuperar pagos a tiempo y reducir la pérdida de clientes.

4. **US-04: Centro de Control de Tenants y Telemetría de Uso:**  
   *Como* Super Administrador,  
   *quiero* buscar, filtrar y abrir un cajón de telemetría de cualquier tenant (ver cuántos clientes, cuentas y ventas tiene registradas),  
   *para* entender el uso de la plataforma, detectar cuentas inactivas y realizar acciones de soporte (extender días, cambiar plan, reset de password).

5. **US-05: Emisión de Alertas Globales (Broadcast Banner):**  
   *Como* Super Administrador,  
   *quiero* publicar avisos del sistema o mantenimientos en tiempo real para todos los tenants,  
   *para* comunicar novedades o contingencias técnicas de forma inmediata.

---

## 3. Alcance Detallado de la Intervención

```
+----------------------------------------------------------------------------------------------------+
|                         SUPER ADMIN CONTROL CENTER 2.0 — ARQUITECTURA DE VISTAS                    |
|                                                                                                    |
|  +---------------------------+  +---------------------------------------------------------------+  |
|  | SUPER ADMIN SIDEBAR       |  | HEADER & BROADCAST BANNER                                     |  |
|  | - Logo StreamControl Pro  |  | - Global System Broadcast Alert (Configurable en tiempo real) |  |
|  | - Dashboard Ejecutivo (/) |  | - Notifications / Admin Profile / Status                      |  |
|  | - Usuarios/Tenants        |  +---------------------------------------------------------------+  |
|  | - Suscripciones           |                                                                     |
|  | - Planes SaaS             |  +---------------------------------------------------------------+  |
|  | - Telegram                |  | VIEWPORT ADMINISTRATIVO SEGMENTADO (rol === 'admin')          |  |
|  | - Ajustes                 |  |                                                               |  |
|  |                           |  |  1. AdminDashboard.tsx:                                      |  |
|  | [ISOLATED: No retail tabs]|  |     * MRR / ARR / ARPU / Active Subscribers                   |  |
|  | - Cuentas (ELIMINADO)     |  |     * AreaChart Crecimiento + Donut Distribución Planes       |  |
|  | - Mayoristas (ELIMINADO)  |  |     * Feed de Vencimientos con WhatsApp 1-Click Billing        |  |
|  | - Códigos (ELIMINADO)     |  |  2. Usuarios.tsx (Tenant Control Center):                     |  |
|  |                           |  |     * Buscador + Multi-filtros (Plan, Estado, Verificación)   |  |
|  |                           |  |     * Telemetry Drawer (Clientes, Cuentas, Ventas, Historial) |  |
|  |                           |  |     * Quick Support: Extender +7/+15/+30d, Cambiar Plan, Pass |  |
|  |                           |  |  3. AdminSuscripciones.tsx:                                   |  |
|  |                           |  |     * Cohortes de Vencimiento + WhatsApp Template Manager     |  |
|  |                           |  |     * Renovación asistida en 1 clic                           |  |
|  |                           |  |  4. AdminPlanes.tsx: Matriz de Precios y Features             |  |
|  +---------------------------+  +---------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

### 3.1 Aislamiento de Navegación y Rutas (`Layout.tsx`, `App.tsx`)
1. **Sidebar del Super Admin:**
   - **Elementos Visibles Exclusivos:**
     1. `Dashboard` (`/` $\rightarrow$ Renderiza `AdminDashboard.tsx`).
     2. `Usuarios` (`/usuarios` $\rightarrow$ Centro de Control de Tenants y Telemetría).
     3. `Suscripciones` (`/admin/suscripciones` $\rightarrow$ Gestión y Cobranzas).
     4. `Planes` (`/admin/planes` $\rightarrow$ Catálogo de Planes y Precios).
     5. `Telegram` (`/telegram` $\rightarrow$ Configuración de Alertas del Bot).
     6. `Ajustes` (`/ajustes` $\rightarrow$ Perfil y Moneda).
   - **Elementos Removidos:**
     - Se eliminan por completo `/cuentas`, `/mayoristas`, `/consulta-codigos`, `/ventas`, `/reportes`, `/gestion-clientes` del menú del admin.
2. **Protección y Redirección en `App.tsx`:**
   - Rutas minoristas (`/cuentas`, `/mayoristas`, `/consulta-codigos`, `/ventas`, `/reportes`, `/gestion-clientes`) quedan restringidas estrictamente a `roles={['usuario']}`.
   - Si un usuario con `rol: 'admin'` accede a una ruta minorista por URL directa, se redirige automáticamente a `/`.

### 3.2 Dashboard Ejecutivo SaaS (`src/pages/AdminDashboard.tsx`)
1. **Tarjetas de Métricas Ejecutivas (KPIs):**
   - **MRR (Monthly Recurring Revenue):** Suma normalizada mensual de todas las suscripciones activas pagadas.
   - **ARR (Annual Run Rate):** $\text{MRR} \times 12$.
   - **Tenants Activos:** Total de operadores con suscripción activa / Total de registrados.
   - **ARPU (Average Revenue Per User):** $\text{MRR} / \text{Tenants Activos}$.
2. **Visualizaciones Recharts Dark SaaS:**
   - **Gráfico de Crecimiento de Ingresos:** Evolución mensual de facturación (AreaChart/BarChart con gradiente índigo-cian).
   - **Distribución de Suscriptores por Plan:** Gráfico de Dona (PieChart con radio interno) categorizado por planes (Starter, Pro, Enterprise, Personalizado).
3. **Feed de Vencimientos Inminentes y Asistente de Cobro WhatsApp:**
   - Tabla reactiva con los próximos vencimientos ($\le 7$ días) y suscripciones vencidas no renovadas.
   - Botón directo de **WhatsApp Billing**: abre `https://wa.me/{telefono}?text={mensaje}` con mensaje personalizado según la proximidad del vencimiento.
   - Botón de extensión rápida (+7 días / +1 mes) para renovar en el acto tras confirmar el pago.

### 3.3 Centro de Control de Tenants y Telemetría (`src/pages/Usuarios.tsx`)
1. **Barra de Búsqueda y Multi-Filtros Avanzados:**
   - Búsqueda en vivo por nombre, correo electrónico o ID.
   - Filtro por Plan: Todos, Starter, Professional, Enterprise, Sin Plan.
   - Filtro por Estado: Todos, Activo, Inactivo.
   - Filtro por Verificación de Correo: Todos, Verificados, Pendientes.
   - Paginación dinámica (10, 25, 50 registros por página).
2. **User Telemetry Drawer (Panel Deslizante de Telemetría):**
   - Al hacer clic en un usuario, se abre un panel lateral (*drawer*) con efecto *backdrop-blur* que realiza lecturas agregadas en tiempo real:
     - **Clientes Totales:** Conteo de clientes creados por el tenant (`clientes` where `usuarioId == uid`).
     - **Cuentas de Streaming:** Conteo de cuentas gestionadas por el tenant (`cuentas` where `usuarioId == uid`).
     - **Volumen de Ventas:** Total de transacciones y monto histórico operado (`ventas` where `usuarioId == uid`).
     - **Detalle de Suscripción:** Plan actual, fecha de inicio/fin, días restantes, estado de pago.
3. **Acciones Rápidas de Soporte y Operación:**
   - **Extender Días:** Botón de un clic para añadir +7, +15 o +30 días a la suscripción activa.
   - **Cambiar Plan:** Modal reactivo para migrar al tenant de plan de forma instantánea.
   - **Restablecer Contraseña:** Envío automático de correo oficial de recuperación vía Firebase Auth.
   - **Chat de Soporte Directo:** Botón de WhatsApp hacia el teléfono del tenant.
   - **Toggle Activo/Inactivo:** Suspensión inmediata de acceso en caso de falta de pago o violación de términos.

### 3.4 Asistente de Suscripciones y Cobranzas (`src/pages/AdminSuscripciones.tsx`)
1. **Filtro por Cohortes de Vencimiento:**
   - Pestañas rápidas: `Todas` | `Vencen en 3 días` | `Vencen en 7 días` | `Vencidas (Mora)` | `Al Día`.
2. **Gestor de Plantillas de Cobro WhatsApp:**
   - Selector de plantilla: *Recordatorio Preventivo*, *Aviso de Vencimiento Hoy*, *Aviso de Suspensión por Falta de Pago*.
   - Generación automática del texto con variables reemplazadas: `{nombre}`, `{plan}`, `{fechaFin}`, `{diasRestantes}`, `{monto}`.
3. **Asistente de Renovación en 1 Clic:**
   - Botón "Renovar Ciclo": crea la nueva suscripción calculando automáticamente la fecha de inicio a partir del vencimiento anterior y el período del plan.

### 3.5 Sistema de Alertas Globales (Broadcast Banner)
1. **Persistencia en Firestore (`config/broadcast`):**
   - Campos: `active` (boolean), `message` (string), `type` (`info` | `warning` | `critical`), `updatedAt` (Timestamp), `updatedBy` (string).
2. **Renderizado Reactivo Global (`Layout.tsx`):**
   - Banner superior con estilos Dark SaaS de alto impacto (`bg-amber-950/70 border-amber-500/40 text-amber-200` para advertencias, `bg-rose-950/70 border-rose-500/40 text-rose-200` para críticas, `bg-indigo-950/70 border-indigo-500/40 text-indigo-200` para información).
3. **Control desde Panel Admin:**
   - Componente en `AdminDashboard.tsx` o `Ajustes.tsx` para encender/apagar el banner y editar el texto en tiempo real.

---

## 4. Análisis de Impacto y Beneficios de Negocio

| Dimensión | Antes (Estado Actual) | Después (Super Admin Control Center 2.0) |
| :--- | :--- | :--- |
| **Enfoque Operativo** | Mezcla confusa de streaming minorista y administración. | 100% de foco en el crecimiento, ingresos y retención del SaaS. |
| **Visibilidad Financiera** | Sin cálculo de MRR, ARR ni ARPU; datos imprecisos. | Métricas SaaS en tiempo real con proyección anual y gráficos de distribución. |
| **Gestión de Cobranzas** | Revisión manual de fechas; mensajes redactados a mano. | Asistente de cobranza 1-click WhatsApp con cohortes de urgencia y plantillas. |
| **Diagnóstico de Clientes (Tenants)** | Desconocimiento del volumen de uso de cada usuario. | Drawer de telemetría con conteo de clientes, cuentas y ventas por operador. |
| **Soporte y Retención** | Procesos lentos para extender días o cambiar planes. | Acciones inmediatas (+7/+15/+30d, cambio de plan, reset de password). |
| **Comunicación Global** | Sin canal de anuncios en tiempo real. | Broadcast Banner reactivo para contingencias y novedades. |

---

## 5. Riesgos Técnicos y Estrategias de Mitigación

| Riesgo Identificado | Nivel | Estrategia de Mitigación |
| :--- | :--- | :--- |
| **Impacto de Lecturas en Firestore por Telemetría** | Medio | Las consultas agregadas de telemetría (clientes, cuentas, ventas por tenant) se ejecutan bajo demanda (*on-demand*) únicamente al abrir el Drawer del usuario seleccionado, no en la lista principal. |
| **Inconsistencias al Extender Suscripciones** | Bajo | Utilizar funciones auxiliares bien testeadas que calculen `Timestamp` preservando la fecha base o extendiendo a partir de `Date.now()` si ya está vencida. |
| **Seguridad en Rutas y Permisos** | Alto | Reforzar las validaciones en `PrivateRoute.tsx` asegurando que los roles sean mutuamente excluyentes para rutas restringidas. |
| **Compatibilidad con Tests Existentes** | Medio | Mantener la suite de tests de Vitest intacta y añadir tests unitarios específicos para `AdminDashboard`, `Usuarios` con telemetría y asistentes de WhatsApp. |
