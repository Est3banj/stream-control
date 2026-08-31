# Documento de Diseño Técnico: Super Admin Control Center 2.0

**Identificador:** `super-admin-control-center`  
**Fecha:** 2026-08-31  
**Autor:** Senior Architect  
**Estado:** Diseño aprobado para SDD  

---

## 1. Arquitectura del Sistema y Separación de Capas

El Super Admin Control Center 2.0 introduce una arquitectura desacoplada donde la capa administrativa de la plataforma opera con independencia de los módulos minoristas (*retail*) de streaming.

```
+--------------------------------------------------------------------------------------------------+
|                                    STREAMCONTROL PRO ARCHITECTURE                                |
|                                                                                                  |
|  +--------------------------------------------------------------------------------------------+  |
|  | AUTENTICACIÓN & CONTROL DE ROLES (AuthContext + PrivateRoute)                               |  |
|  | - rol === 'admin'   --> Entorno Super Admin SaaS (Métricas, Tenants, Planes, Cobranzas)     |  |
|  | - rol === 'usuario' --> Entorno Tenant Retail (Streaming, Cuentas, Clientes, Ventas)          |  |
|  +--------------------------------------------------------------------------------------------+  |
|                                                                                                  |
|  +-------------------------------------------------------------+  +---------------------------+  |
|  | CAPA DE PRESENTACIÓN SUPER ADMIN (Dark SaaS Theme)          |  | SERVICIOS & HOOKS REACT   |  |
|  |                                                             |  |                           |  |
|  | 1. BroadcastBanner.tsx (Alerta global reactiva en header)   |  | - useAdminMetrics.ts      |  |
|  | 2. AdminDashboard.tsx                                      |  |   (MRR, ARR, ARPU, Churn) |  |
|  |    ├── MetricCardsGrid (MRR, ARR, ARPU, Active Tenants)     |  | - useBroadcastBanner.ts   |  |
|  |    ├── RevenueGrowthChart (AreaChart Recharts Dark)         |  |   (Realtime Firestore)    |  |
|  |    ├── PlanDistributionDonut (PieChart Recharts Dark)       |  | - useTenantTelemetry.ts   |  |
|  |    └── UrgentExpirationsFeed (1-Click WhatsApp Assistant)   |  |   (On-demand Aggregates)  |  |
|  | 3. Usuarios.tsx (Tenant Control Center)                     |  | - useSuscripciones.ts     |  |
|  |    ├── FilterBar & Dynamic Search                           |  | - usePlanes.ts            |  |
|  |    ├── TenantsDataTable (Status, Plan, Verified, Actions)   |  | - useMoneda.ts            |  |
|  |    └── UserTelemetryDrawer (Clientes, Cuentas, Ventas)      |  +---------------------------+  |
|  | 4. AdminSuscripciones.tsx (Cohortes & Plantillas WhatsApp)  |                                 |
|  | 5. AdminPlanes.tsx (Matriz de Precios y Features)           |                                 |
|  +-------------------------------------------------------------+                                 |
|                                                                                                  |
|  +--------------------------------------------------------------------------------------------+  |
|  | CAPA DE PERSISTENCIA FIRESTORE                                                             |  |
|  | - /suscripciones (Index: usuarioId, estado, fechaFin, pagoEstado)                           |  |
|  | - /usuarios (Index: estado, rol, createdAt)                                                 |  |
|  | - /planes (Index: activo, precio)                                                           |  |
|  | - /config/broadcast (Banner global)                                                         |  |
|  | - /config/general (WhatsApp support, moneda global)                                         |  |
|  | - /clientes, /cuentas, /ventas (Filtradas por usuarioId para telemetría)                     |  |
|  +--------------------------------------------------------------------------------------------+  |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Jerarquía de Componentes y Contenedores

```
Layout.tsx
 ├── BroadcastBanner.tsx (Visible para todos los usuarios si broadcast.active === true)
 ├── Sidebar.tsx
 │    ├── Logo & Brand Header
 │    ├── Dynamic Navigation List (Segmentada según user.rol)
 │    │    ├── Admin Nav: Dashboard (/), Usuarios, Suscripciones, Planes, Telegram, Ajustes
 │    │    └── Tenant Nav: Dashboard (/), Ventas, Reportes, Clientes, Cuentas, Mayoristas, Códigos
 │    ├── PWAInstallButton
 │    └── User Profile & Logout
 ├── Header.tsx (Sticky blur, NotificationsPanel, Mobile Trigger)
 └── Main Viewport
      ├── [rol === 'admin'] --> AdminDashboard.tsx
      │    ├── AdminHeader (Título + Botón Configurar Broadcast + Switch Rápido)
      │    ├── MetricCardsGrid:
      │    │    ├── Card MRR (Monthly Recurring Revenue + Indicador ARR)
      │    │    ├── Card Suscriptores Activos (Activos vs Registrados + ARPU)
      │    │    ├── Card Por Vencer / Mora (Suscripciones $\le 7$ días o en mora)
      │    │    └── Card Total Facturado (Histórico total cobrado)
      │    ├── VisualizationsGrid:
      │    │    ├── RevenueAreaChart (Evolución de facturación mensual en Recharts)
      │    │    └── PlanDonutChart (Distribución por planes con Tooltip Dark)
      │    └── ExpirationsAssistantSection:
      │         ├── Cohort Filter Chips (Próximos 7 días, Vencidos sin renovar)
      │         └── ExpirationsTable (Tenant, Plan, Vence En, WhatsApp 1-Click, Extender +7d)
      │
      ├── [rol === 'admin'] --> Usuarios.tsx (Centro de Gestión de Tenants)
      │    ├── TopToolbar (Buscador reactivo, Selector de Plan, Selector de Estado, Botón Crear)
      │    ├── UsersTable (Avatar, Nombre/Email, Badge Verificado, Plan, Estado, Acciones)
      │    ├── Paginador.tsx (Controles de paginación)
      │    ├── UserTelemetryDrawer.tsx (Slide-over panel al seleccionar tenant):
      │    │    ├── Tenant Profile Summary
      │    │    ├── Usage Telemetry Grid (Total Clientes, Total Cuentas, Volumen Ventas)
      │    │    ├── Active Subscription Card
      │    │    ├── Quick Support Action Bar (Extender +7/+15/+30d, Cambiar Plan, Reset Pass)
      │    │    └── Subscription History Timeline
      │    └── Modals: CrearUsuarioModal, CambiarPlanModal, WhatsAppCustomModal
      │
      └── [rol === 'admin'] --> AdminSuscripciones.tsx
           ├── CohortTabs (Todas, Vencen en 3d, Vencen en 7d, Vencidas, Activas)
           ├── WhatsAppTemplateBar (Selector de plantilla + Vista previa del mensaje)
           ├── SubscriptionsGrid / Table
           └── Modals: NuevaSuscripcionModal, RenovarSuscripcionModal
```

---

## 3. Modelo de Datos y Consultas Firestore

### 3.1 Documento de Broadcast (`config/broadcast`)
```typescript
export interface BroadcastConfig {
  active: boolean;
  message: string;
  type: 'info' | 'warning' | 'critical';
  updatedAt: Timestamp;
  updatedBy: string;
}
```

### 3.2 Consultas de Telemetría Bajo Demanda (On-Demand Telemetry)
Para evitar saturar la cuota de lecturas de Firestore, las estadísticas de un tenant solo se consultan cuando el administrador abre su Drawer:

```typescript
// Telemetría de clientes gestionados por el tenant
const clientesSnap = await getDocs(
  query(collection(db, 'clientes'), where('usuarioId', '==', tenantUid))
);
const totalClientes = clientesSnap.size;

// Telemetría de cuentas de streaming gestionadas
const cuentasSnap = await getDocs(
  query(collection(db, 'cuentas'), where('usuarioId', '==', tenantUid))
);
const totalCuentas = cuentasSnap.size;

// Telemetría de ventas y volumen económico
const ventasSnap = await getDocs(
  query(collection(db, 'ventas'), where('usuarioId', '==', tenantUid))
);
const totalVentas = ventasSnap.size;
const volumenTotalVentas = ventasSnap.docs.reduce((sum, doc) => {
  const v = doc.data();
  return sum + (Number(v.precioVenta) * Number(v.pantallas || 1));
}, 0);
```

### 3.3 Motor de Cálculo de Métricas Financieras (`useAdminMetrics`)
```typescript
export function useAdminMetrics(suscripciones: Suscripcion[], usuarios: Usuario[]) {
  return useMemo(() => {
    const now = Date.now();
    const suscripcionesActivas = suscripciones.filter(s => s.estado === 'activa');
    const suscripcionesPagadas = suscripcionesActivas.filter(s => s.pagoEstado === 'pagado');

    // Cálculo normalizado de MRR
    let mrr = 0;
    suscripcionesPagadas.forEach(s => {
      const monto = Number(s.monto) || 0;
      const planLower = (s.planNombre || '').toLowerCase();
      
      if (planLower.includes('anual')) {
        mrr += monto / 12;
      } else if (planLower.includes('semestral')) {
        mrr += monto / 6;
      } else if (planLower.includes('trimestral')) {
        mrr += monto / 3;
      } else {
        mrr += monto; // Base mensual
      }
    });

    const arr = mrr * 12;
    const totalTenants = usuarios.filter(u => u.rol !== 'admin').length;
    const activeTenantIds = new Set(suscripcionesPagadas.map(s => s.usuarioId));
    const activeTenantsCount = activeTenantIds.size;
    const arpu = activeTenantsCount > 0 ? mrr / activeTenantsCount : 0;

    // Próximos vencimientos (<= 7 días)
    const sieteDiasMs = 7 * 24 * 60 * 60 * 1000;
    const proximosVencimientos = suscripcionesActivas.filter(s => {
      if (!s.fechaFin?.seconds) return false;
      const fechaFinMs = s.fechaFin.seconds * 1000;
      const diff = fechaFinMs - now;
      return diff >= 0 && diff <= sieteDiasMs;
    });

    // Vencidas sin renovar
    const vencidasSinRenovar = suscripciones.filter(s => {
      if (!s.fechaFin?.seconds) return false;
      const fechaFinMs = s.fechaFin.seconds * 1000;
      return fechaFinMs < now && s.estado !== 'cancelada';
    });

    return {
      mrr,
      arr,
      arpu,
      totalTenants,
      activeTenantsCount,
      suscripcionesActivasCount: suscripcionesActivas.length,
      proximosVencimientos,
      vencidasSinRenovar,
    };
  }, [suscripciones, usuarios]);
}
```

---

## 4. Especificación Visual y Recharts Dark Theme

### 4.1 Estilos de Tarjetas KPI Dark SaaS
- **Superficie:** `bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl`
- **Iconos con Contenedor Glow:**
  - MRR: `bg-emerald-500/15 border border-emerald-500/30 text-emerald-400`
  - ARR: `bg-indigo-500/15 border border-indigo-500/30 text-indigo-400`
  - Tenants: `bg-cyan-500/15 border border-cyan-500/30 text-cyan-400`
  - Vencimientos / Mora: `bg-amber-500/15 border border-amber-500/30 text-amber-400`

### 4.2 Configuración Recharts Dark Mode

```tsx
// AreaChart: Crecimiento de Ingresos
<ResponsiveContainer width="100%" height={280}>
  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
    <defs>
      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
    <XAxis dataKey="mes" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
    <Tooltip
      contentStyle={{
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderRadius: '0.75rem',
        color: '#f8fafc',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      }}
      formatter={(val: any) => [formatearDesdeBase(val), 'Ingresos']}
    />
    <Area
      type="monotone"
      dataKey="ingresos"
      stroke="#6366f1"
      strokeWidth={3}
      fillOpacity={1}
      fill="url(#colorRevenue)"
    />
  </AreaChart>
</ResponsiveContainer>
```

---

## 5. Diseño del Drawer de Telemetría (User Telemetry Drawer)

### Estructura Visual:
1. **Header Fijo:**
   - Avatar del usuario + Nombre completo + Email + Badge de Verificación.
   - Botón de cierre (`X`) accesible con teclado.
2. **Tablero de Telemetría de Uso (3 Cards Compactas):**
   - 👥 **Clientes:** Número total de clientes finales registrados por este tenant.
   - 📺 **Cuentas:** Total de cuentas maestras de streaming cargadas.
   - 💰 **Volumen Operado:** Total de dinero transaccionado por el tenant en su negocio minorista.
3. **Tarjeta de Suscripción Vigente:**
   - Plan actual (Starter / Pro / Enterprise).
   - Fecha de vencimiento y barra de progreso de días restantes.
   - Estado de pago (`Pagado` | `Pendiente`).
4. **Barra de Acciones de Soporte Inmediatas:**
   - `[+7 Días]` `[+15 Días]` `[+30 Días]` (Extensión en 1 clic).
   - `[Cambiar Plan]` (Abre modal de selección de planes).
   - `[Enviar Reset Contraseña]` (Dispara email de Firebase Auth).
   - `[Chatear por WhatsApp]` (Abre chat con número del usuario).
5. **Historial de Suscripciones:**
   - Lista cronológica de ciclos contratados por el usuario.

---

## 6. Seguridad y Reglas de Control de Acceso

1. **Client-Side Guard (`PrivateRoute.tsx`):**
   - Se parametriza con `roles: ('admin' | 'usuario')[]`.
   - Si la ruta requiere `roles={['usuario']}` y el usuario logueado es `rol: 'admin'`, se redirige automáticamente a `/` evitando el acceso a vistas de retail.
2. **Firestore Security Rules:**
   - Los tenants únicamente tienen permisos de lectura y escritura sobre colecciones donde `request.auth.uid == resource.data.usuarioId`.
   - El Super Admin (`request.auth.token.email == 'estebanjurado2005@gmail.com'` o `get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin'`) mantiene permisos globales de lectura/escritura en todas las colecciones de la plataforma.
