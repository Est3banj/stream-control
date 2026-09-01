# Documento de Diseño Técnico: Reestructuración de Planes y Estrategia PLG

**Identificador:** `reestructuracion-planes-plg`  
**Fecha:** 2026-09-01  
**Autor:** Senior Architect  
**Estado:** Diseño aprobado para SDD  

---

## 1. Arquitectura del Sistema y Separación de Tiers

El rediseño del sistema de planes establece una arquitectura modular de permisos y cuotas impulsada por la estrategia Product-Led Growth (PLG), garantizando una experiencia de usuario inmediata en Starter y barreras de valor claras para Professional y Enterprise.

```
+--------------------------------------------------------------------------------------------------+
|                                    STREAMCONTROL PLG ARCHITECTURE                                |
|                                                                                                  |
|  +--------------------------------------------------------------------------------------------+  |
|  | AUTENTICACIÓN & IDENTIDAD (AuthContext + usePermisos)                                       |  |
|  | - Sincroniza suscripción activa del usuario desde /suscripciones                            |  |
|  | - Si no existe suscripción activa: Asigna STARTER (20 clientes, 5 cuentas, Dashboard ON)    |  |
|  | - Si user.rol === 'admin': Acceso total ilimitado al panel SaaS                            |  |
|  +--------------------------------------------------------------------------------------------+  |
|                                                                                                  |
|  +-------------------------------------------------------------+  +---------------------------+  |
|  | CAPA DE PRESENTACIÓN & ENRUTAMIENTO (Dark SaaS Theme)       |  | MOTOR DE CUOTAS Y GATING  |  |
|  |                                                             |  |                           |  |
|  | 1. Dashboard.tsx (Desbloqueado para todos los usuarios)     |  | - usePermisos.ts          |  |
|  | 2. GestionCuentas.tsx (Desbloqueado con cuota de 5 cuentas) |  |   (clienteLimit,          |  |
|  | 3. SelectorCuenta.tsx (Desbloqueado para Starter)           |  |    cuentaLimit)           |  |
|  | 4. VentasForm.tsx (Validación uniforme en Simple y Combo)   |  | - quotaValidator.ts       |  |
|  | 5. UpgradeModal.tsx (Comparador de 3 planes + CTA WhatsApp) |  |   (Cliente existente vs   |  |
|  | 6. FeatureBlocked.tsx (Gating de Telegram, Reportes, OTP)   |  |    nuevo con límite)      |  |
|  +-------------------------------------------------------------+  +---------------------------+  |
|                                                                                                  |
|  +--------------------------------------------------------------------------------------------+  |
|  | CAPA DE PERSISTENCIA FIRESTORE                                                             |  |
|  | - /clientes (Conteo indexado por propietarioId para verificación de clienteLimit)           |  |
|  | - /cuentas (Conteo indexado por propietarioId para verificación de cuentaLimit)             |  |
|  | - /suscripciones (Control de estado: 'activa', planNombre, pagoEstado)                      |  |
|  | - /planes (Definición de catálogo y precios por período)                                   |  |
|  +--------------------------------------------------------------------------------------------+  |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Contratos TypeScript y Modelo de Permisos

### 2.1 Interfaz `Permisos` (`src/hooks/usePermisos.ts`)
```typescript
export interface Permisos {
  /** Nombre del plan actual del usuario ('Starter' | 'Professional' | 'Enterprise' | 'Admin') */
  planNombre: string | null;
  /** Indicador de carga de la suscripción */
  loading: boolean;
  /** Clientes máximos permitidos (Infinity = ilimitado, Starter = 20) */
  clienteLimit: number;
  /** Cuentas máximas de streaming permitidas en inventario (Infinity = ilimitado, Starter = 5) */
  cuentaLimit: number;
  /** Puede vincular bot de Telegram */
  puedeUsarTelegram: boolean;
  /** Puede ver reportes avanzados con filtros de fecha y desglose */
  puedeVerReportesAvanzados: boolean;
  /** Puede exportar listados a Excel/CSV */
  puedeExportarExcel: boolean;
  /** Puede ver dashboard ejecutivo de negocio */
  puedeVerDashboardEjecutivo: boolean;
  /** Tiene soporte prioritario */
  tieneSoportePrioritario: boolean;
  /** Tiene soporte 24/7 */
  tieneSoporte247: boolean;
  /** Puede gestionar cuentas de streaming en inventario y vincularlas */
  puedeGestionarCuentas: boolean;
  /** Puede generar tokens de consulta de códigos y links públicos */
  puedeGenerarTokens: boolean;
}
```

### 2.2 Matriz de Características (`PLAN_FEATURES`)
```typescript
export const PLAN_FEATURES: Record<string, Partial<Permisos>> = {
  Starter: {
    clienteLimit: 20,
    cuentaLimit: 5,
    puedeUsarTelegram: false,
    puedeVerReportesAvanzados: false,
    puedeExportarExcel: true,
    puedeVerDashboardEjecutivo: true,
    tieneSoportePrioritario: false,
    tieneSoporte247: false,
    puedeGestionarCuentas: true,
    puedeGenerarTokens: false,
  },
  Professional: {
    clienteLimit: Infinity,
    cuentaLimit: Infinity,
    puedeUsarTelegram: true,
    puedeVerReportesAvanzados: true,
    puedeExportarExcel: true,
    puedeVerDashboardEjecutivo: true,
    tieneSoportePrioritario: true,
    tieneSoporte247: false,
    puedeGestionarCuentas: true,
    puedeGenerarTokens: false,
  },
  Enterprise: {
    clienteLimit: Infinity,
    cuentaLimit: Infinity,
    puedeUsarTelegram: true,
    puedeVerReportesAvanzados: true,
    puedeExportarExcel: true,
    puedeVerDashboardEjecutivo: true,
    tieneSoportePrioritario: true,
    tieneSoporte247: true,
    puedeGestionarCuentas: true,
    puedeGenerarTokens: true,
  },
};
```

---

## 3. Algoritmo de Verificación de Cuotas

### 3.1 Verificación de Cuota de Clientes en Ventas (`VentasForm.tsx`)
Para evitar bloquear ventas legítimas a clientes ya registrados, el algoritmo sigue una validación en 2 pasos:

```typescript
async function validarCuotaCliente(
  userUid: string,
  clienteNombre: string,
  clienteLimit: number
): Promise<{ permitido: boolean; mensajeError?: string }> {
  if (clienteLimit === Infinity) return { permitido: true };

  const nombreNormalizado = clienteNombre.trim();
  if (!nombreNormalizado) return { permitido: true };

  try {
    // 1. Verificar si el cliente ya existe en la base de datos
    const clienteRef = doc(db, 'clientes', `${userUid}_${nombreNormalizado}`);
    const clienteSnap = await getDoc(clienteRef);
    if (clienteSnap.exists()) {
      // Cliente existente: no consume nueva cuota
      return { permitido: true };
    }

    // 2. Si es cliente nuevo, verificar el conteo total actual
    const countQuery = query(
      collection(db, 'clientes'),
      where('propietarioId', '==', userUid)
    );
    const countSnap = await getDocs(countQuery);

    if (countSnap.size >= clienteLimit) {
      return {
        permitido: false,
        mensajeError: `Alcanzaste el límite de ${clienteLimit} clientes del plan Starter. Actualizá a Professional para clientes ilimitados.`,
      };
    }

    return { permitido: true };
  } catch (error) {
    console.warn('[validarCuotaCliente] Error verificando cuota:', error);
    return { permitido: true }; // Fallback tolerante en fallos de red
  }
}
```

### 3.2 Verificación de Cuota de Cuentas en Inventario (`GestionCuentas.tsx`)
```typescript
function validarCuotaCuentas(
  totalCuentasActuales: number,
  cuentaLimit: number
): { permitido: boolean; mensajeError?: string } {
  if (cuentaLimit === Infinity) return { permitido: true };

  if (totalCuentasActuales >= cuentaLimit) {
    return {
      permitido: false,
      mensajeError: `Alcanzaste el límite de ${cuentaLimit} cuentas streaming del plan Starter. Actualizá a Professional para cuentas ilimitadas.`,
    };
  }

  return { permitido: true };
}
```

---

## 4. Diseño Visual y Componentes de Interfaz

### 4.1 Banner de Cuota en `GestionClientes.tsx`
```tsx
{user?.rol !== 'admin' && permisos.planNombre === 'Starter' && (
  <div className="bg-gradient-to-r from-amber-950/40 to-orange-950/40 border border-amber-800/50 rounded-2xl p-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <Sparkles className="text-amber-400 shrink-0" size={20} />
      <div>
        <p className="text-sm font-medium text-amber-300">
          Plan Starter — <strong>{clientes.todos.length}</strong> de {permisos.clienteLimit} clientes usados
        </p>
        <p className="text-xs text-amber-400/80 mt-0.5">
          Actualizá a Professional para clientes ilimitados y alertas automáticas por Telegram.
        </p>
      </div>
    </div>
    <button
      onClick={() => showUpgradeModal()}
      className="btn-primary text-xs py-2 px-4 whitespace-nowrap"
    >
      Actualizar a Pro
    </button>
  </div>
)}
```

### 4.2 Banner de Cuota en `GestionCuentas.tsx`
```tsx
{user?.rol !== 'admin' && permisos.planNombre === 'Starter' && (
  <div className="bg-gradient-to-r from-indigo-950/40 to-violet-950/40 border border-indigo-800/50 rounded-2xl p-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <Film className="text-indigo-400 shrink-0" size={20} />
      <div>
        <p className="text-sm font-medium text-indigo-300">
          Plan Starter — <strong>{todasLasCuentas.length}</strong> de {permisos.cuentaLimit} cuentas registradas
        </p>
        <p className="text-xs text-indigo-400/80 mt-0.5">
          Actualizá a Professional para inventario de cuentas y perfiles ilimitados.
        </p>
      </div>
    </div>
    <button
      onClick={() => showUpgradeModal()}
      className="btn-primary text-xs py-2 px-4 whitespace-nowrap"
    >
      Desbloquear Ilimitado
    </button>
  </div>
)}
```

### 4.3 Tabla Comparativa en `UpgradeModal.tsx`
Las tarjetas de planes se actualizan para reflejar la escalera de valor exacta:

| Característica | Starter (Gratis) | Professional (Pro) | Enterprise (Mayorista) |
| :--- | :---: | :---: | :---: |
| **Límite de Clientes** | 20 clientes | **Ilimitado** | **Ilimitado** |
| **Límite de Cuentas Streaming** | 5 cuentas | **Ilimitado** | **Ilimitado** |
| **Gestión de Cuentas & Perfiles** | Sí | Sí | Sí |
| **Tickets WhatsApp con PIN** | Sí | Sí | Sí |
| **Exportación a Excel / CSV** | Sí | Sí | Sí |
| **Bot Telegram (@NotiStream_bot)** | — | **Sí (Alertas 24/7)** | **Sí (Alertas 24/7)** |
| **Reportes Financieros Avanzados** | — | **Sí (Filtros fecha)** | **Sí (Filtros fecha)** |
| **Consulta Códigos OTP IMAP** | — | — | **Sí (Automática)** |
| **Módulo Ventas Mayoristas** | — | — | **Sí (/mayoristas)** |
| **Portal Público de Consulta** | — | — | **Sí (/r/:token)** |
| **Nivel de Soporte** | Estándar | Prioritario | VIP 24/7 |

---

## 5. Pruebas y Estrategia de Verificación

1. **Unit Tests en `usePermisos.ts`:**
   - Validar que un usuario sin suscripción reciba `Starter` con `clienteLimit: 20` y `cuentaLimit: 5`.
   - Validar que un usuario `Professional` reciba `clienteLimit: Infinity` y `cuentaLimit: Infinity`.
   - Validar que un usuario `Enterprise` reciba `puedeGenerarTokens: true`.
2. **Unit Tests en `VentasForm.test.tsx`:**
   - Validar que el cliente #1 se registre sin error de cuota.
   - Validar que cuando un usuario Starter alcanza 20 clientes, el cliente #21 sea rechazado con toast.
   - Validar que una venta combo hacia un cliente nuevo valide la cuota de 20 clientes.
   - Validar que una venta a un cliente existente proceda con éxito aún teniendo 20 clientes.
3. **Unit Tests en `UpgradeModal.test.tsx`:**
   - Validar que se rendericen correctamente los textos `20 clientes` y `5 cuentas` en Starter y `Ilimitado` en Pro/Enterprise.
