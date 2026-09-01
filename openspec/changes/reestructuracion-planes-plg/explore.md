# Exploración: Reestructuración de Planes y Estrategia PLG (Product-Led Growth)

**Identificador:** `reestructuracion-planes-plg`  
**Fecha:** 2026-09-01  
**Autor:** Senior Architect  
**Estado:** Exploración completada  

---

## 1. Contexto y Diagnóstico del Modelo PLG Actual

StreamControl Pro es una plataforma SaaS multi-tenant diseñada para distribuidores y revendedores de cuentas de streaming (Netflix, Disney+, Max, Prime Video, etc.). Para acelerar la adquisición orgánica de usuarios y maximizar la conversión a planes de pago, la plataforma debe adoptar una estrategia **Product-Led Growth (PLG)** impecable: permitir que cualquier usuario recién registrado experimente el valor central del producto (**el momento "¡Aha!"**) en menos de 2 minutos, sin barreras artificiales ni errores frustrantes.

### 1.1 El Diagnóstico: Fricciones Críticas en la Experiencia Inicial (Free / Starter)

La auditoría del código actual revela **fallas graves de arquitectura y configuración** que destruyen la activación de usuarios desde el segundo 1 tras registrarse:

1. **Dashboard Inicial Bloqueado (`/` con `<FeatureBlocked />`):**
   - En `src/pages/Dashboard.tsx` (línea 159), existe la guarda:
     ```tsx
     if (!permisos.puedeVerDashboardEjecutivo) {
       return <FeatureBlocked feature="Dashboard Ejecutivo" plan="Enterprise" />;
     }
     ```
   - En `src/hooks/usePermisos.ts`, `puedeVerDashboardEjecutivo` solo está activo para `Enterprise`.
   - **Consecuencia:** Cuando un nuevo usuario se registra o entra con Starter/Professional, aterriza en `/` y lo primero que ve es un candado gigante bloqueando la pantalla principal exigiendo Enterprise. Esto es un antipatrón letal para cualquier SaaS.

2. **`DEFAULT_PERMISOS` con Cuota Cero (`clienteLimit: 0`):**
   - En `src/hooks/usePermisos.ts` (línea 66):
     ```tsx
     const DEFAULT_PERMISOS: Permisos = {
       planNombre: null,
       loading: true,
       clienteLimit: 0,
       // ...
     };
     ```
   - Cuando un usuario se registra, no tiene documento en `suscripciones`. `usePermisos` retorna `DEFAULT_PERMISOS` con `planNombre: 'Starter'` pero con `clienteLimit: 0`.
   - Al intentar registrar su primera venta en `src/components/VentasForm.tsx` (línea 505):
     ```tsx
     if (countSnap.size >= permisos.clienteLimit) { // 0 >= 0 es TRUE
       return toast.error("Alcanzaste el límite de 0 clientes del plan Starter.");
     }
     ```
   - **Consecuencia:** El usuario no puede registrar ni un solo cliente. Su primer intento de uso falla inmediatamente con un mensaje absurdo de "Límite de 0 clientes".

3. **Bloqueo Total del Inventario de Cuentas (`/cuentas` bloqueado en Starter):**
   - En `src/pages/GestionCuentas.tsx` (línea 294), se verifica:
     ```tsx
     if (!permisos.puedeGestionarCuentas) {
       return <FeatureBlocked feature="Gestión de Cuentas" plan="Professional" />;
     }
     ```
   - En `src/components/SelectorCuenta.tsx` (línea 100):
     ```tsx
     if (!proveedor || !permisos.puedeGestionarCuentas) return null;
     ```
   - En `usePermisos.ts`, `Starter` tiene `puedeGestionarCuentas: false`.
   - **Consecuencia:** El usuario en Starter no puede registrar cuentas de streaming ni vincular perfiles a sus ventas. Se le priva de la funcionalidad estrella del sistema (la asignación automática de perfiles, control de PINs y generación de tickets de entrega).

4. **Inconsistencia en la Aplicación de Cuotas (Ventas Combo vs Simples):**
   - En `VentasForm.tsx`, el método `handleSubmitSimple` verifica `countSnap.size >= permisos.clienteLimit`, pero `handleSubmitMulti` (ventas combinadas) **no realiza ninguna validación de límite de clientes**.
   - Un usuario en plan Starter podría saltarse indefinidamente el límite de clientes simplemente registrando ventas en modo combo.
   - Además, la validación de clientes cuenta todos los registros de la colección sin discriminar si el cliente ya existía (una venta adicional a un cliente existente consume una cuota nueva erróneamente).
   - Tampoco existe un límite de cuentas de streaming (`cuentaLimit`) en `GestionCuentas.tsx` ni en `CuentaForm.tsx`.

---

## 2. Definición y Propuesta de Valor de los 3 Tiers

Para alinear el modelo comercial con la psicología del revendedor de streaming, reestructuramos los tres niveles con fronteras claras y gatillos de actualización (*upgrade triggers*) basados en el crecimiento del negocio del usuario:

```
+----------------------------------------------------------------------------------------------------+
|                                    ESTRUCTURA DE PLANES SAAS PLG                                   |
|                                                                                                    |
|  +---------------------------+  +---------------------------+  +--------------------------------+  |
|  | STARTER (Free / PLG Hook) |  | PROFESSIONAL (Solo Pro)   |  | ENTERPRISE (Mayorista/Agencia) |  |
|  | zsh / Siempre              |  |  / mes                  |  |  / mes                       |  |
|  | "Empieza a vender hoy"    |  | "Automatiza y escala"     |  | "Opera tu red mayorista"       |  |
|  +---------------------------+  +---------------------------+  +--------------------------------+  |
|  | • Dashboard Desbloqueado  |  | • TODO lo de Starter      |  | • TODO lo de Professional      |  |
|  | • Hasta 20 clientes       |  | • Clientes ILIMITADOS     |  | • Consulta OTP IMAP Automática |  |
|  | • Hasta 5 cuentas madre   |  | • Cuentas ILIMITADAS      |  |   (Netflix, Disney, Max, etc.) |  |
|  | • Ventas simples y combo  |  | • Bot de Telegram 24/7    |  | • Módulo Mayoristas (/mayor.)  |  |
|  | • Tickets WhatsApp        |  |   (Alertas vencim./mora)  |  | • Tokens de acceso y links r/  |  |
|  | • Exportación básica CSV  |  | • Reportes Financieros    |  | • Portal público de consulta   |  |
|  |                           |  |   Avanzados (Filtros fecha|  | • Soporte VIP Prioritario 24/7|  |
|  |                           |  | • Soporte Prioritario     |  |                                |  |
|  +---------------------------+  +---------------------------+  +--------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Starter (Gratuito / Free Tier): El Gancho PLG
- **Público Objetivo:** Revendedor novato o persona que está probando la plataforma con un puñado de clientes (amigos/familiares).
- **Objetivo de Negocio:** Adquisición sin fricción, retención temprana y adopción del flujo de trabajo de StreamControl.
- **Límites Clave:**
  - `clienteLimit: 20` (Suficiente para validar el producto, pero obliga a pagar en cuanto el negocio arranca).
  - `cuentaLimit: 5` (Hasta 5 cuentas maestras en inventario).
  - `puedeGestionarCuentas: true` (Desbloqueado para vivir el Momento ¡Aha!).
  - `puedeVerDashboard: true` (Dashboard `/` desbloqueado con métricas de ventas e ingresos).
  - Ventas individuales y combos habilitadas.
  - Tickets WhatsApp con credenciales y PINs.
  - Exportación básica a Excel/CSV desde la lista de clientes.

### 2.2 Professional (Solo Reseller): La Herramienta de Trabajo Diaria
- **Público Objetivo:** Revendedor activo individual que gestiona entre 25 y 200+ clientes y vive de su negocio de streaming.
- **Propuesta de Valor:** Eliminación total de techos de clientes e inventario + automatización de cobranza y vencimientos.
- **Diferenciadores Clave:**
  - `clienteLimit: Infinity` (Sin límite de clientes).
  - `cuentaLimit: Infinity` (Sin límite de cuentas madre).
  - `puedeUsarTelegram: true` (Bot @NotiStream_bot con alertas automáticas 3, 2 y 1 día antes del vencimiento, recordatorios de mora matutinos).
  - `puedeVerReportesAvanzados: true` (Pestaña `/reportes` con filtros por rango de fechas, discriminación de ventas cliente vs sub-distribuidor, métricas de ticket promedio y exportación financiera completa).
  - `tieneSoportePrioritario: true`.

### 2.3 Enterprise (Mayorista / Distribuidor / Agencia): Automatización OTP y Reventa B2B
- **Público Objetivo:** Mayoristas, proveedores de cuentas completas, agencias y distribuidores con revendedores a su cargo.
- **Propuesta de Valor:** Automatización del dolor de cabeza número 1 de la industria (códigos OTP de Netflix Hogar / Viaje y Disney+) + venta mayorista de perfiles por lote.
- **Diferenciadores Clave:**
  - Todo lo incluido en Professional.
  - `puedeGenerarTokens: true` & `puedeConsultarCodigos: true`:
    - Acceso al módulo `/consulta-codigos` para extracción directa de códigos OTP vía IMAP.
    - Generación de links de consulta pública (`/r/:token`) para que los clientes finales o revendedores saquen sus propios códigos sin molestar al administrador.
  - Módulo `/mayoristas` para venta por lotes a sub-distribuidores con expiración automática de accesos y tokens.
  - `tieneSoporte247: true` (Atención prioritaria 24/7 para incidencias críticas).

---

## 3. Diagnóstico Técnico de Componentes Afectados

### 3.1 Motor de Permisos (`src/hooks/usePermisos.ts` y `src/hooks/planFeatures.ts`)
- **Problema:** La interfaz `Permisos` no contempla `cuentaLimit`. Las constantes `PLAN_FEATURES` y `DEFAULT_PERMISOS` tienen valores desactualizados (`clienteLimit: 0` en default, `puedeGestionarCuentas: false` en Starter, `puedeVerDashboardEjecutivo: false` bloqueando el Dashboard).
- **Solución:**
  - Extender `Permisos` con `cuentaLimit: number`.
  - Configurar `DEFAULT_PERMISOS` para reflejar el plan Starter (`clienteLimit: 20`, `cuentaLimit: 5`, `puedeGestionarCuentas: true`, `puedeVerDashboard: true`).
  - Actualizar `PLAN_FEATURES` para `Starter`, `Professional` y `Enterprise`.
  - Actualizar `FEATURE_LABELS` y `PLAN_UPGRADE_TARGET` en `planFeatures.ts`.

### 3.2 Dashboard de Operador (`src/pages/Dashboard.tsx`)
- **Problema:** Condicional restrictivo `if (!permisos.puedeVerDashboardEjecutivo)` que renderiza `<FeatureBlocked />`.
- **Solución:**
  - Remover la guarda que bloquea el Dashboard `/` para usuarios regulares. El Dashboard básico con ingresos, egresos, utilidad, top clientes y plataformas debe ser accesible para todos los usuarios autenticados.
  - El Super Admin (`rol: 'admin'`) sigue viendo `AdminDashboard.tsx`.

### 3.3 Formularios de Ventas e Inventario (`src/components/VentasForm.tsx`, `src/pages/GestionCuentas.tsx`, `src/components/CuentaForm.tsx`)
- **Problema:**
  - `VentasForm.tsx`: El límite de clientes solo se chequea en `handleSubmitSimple`, permitiendo bypass en `handleSubmitMulti`. Además, no discrimina si el cliente ya existe en Firestore.
  - `GestionCuentas.tsx`: No se valida el límite de cuentas (`cuentaLimit`) antes de registrar una nueva cuenta (`crearCuenta`).
- **Solución:**
  - Crear una función centralizada de verificación de cuota de clientes que verifique si el cliente es nuevo antes de computar contra el límite.
  - Aplicar la validación tanto en `handleSubmitSimple` como en `handleSubmitMulti`.
  - En `GestionCuentas.tsx` y `SelectorCuenta.tsx`, verificar `cuentas.length < permisos.cuentaLimit` antes de abrir el modal o guardar una cuenta nueva. Si alcanza el límite, disparar modal de upgrade o toast explicativo con opción de actualización.

### 3.4 Modal de Actualización y Banners de Cuota (`src/components/UpgradeModal.tsx`, `src/pages/GestionClientes.tsx`, `src/pages/GestionCuentas.tsx`)
- **Problema:**
  - `UpgradeModal.tsx`: Los textos y características no reflejan el nuevo límite de 20 clientes y 5 cuentas en Starter, ni la clara segmentación de Telegram/Reportes en Pro y Códigos IMAP/Mayoristas en Enterprise.
  - `GestionClientes.tsx`: El banner de aviso de Starter mostraba `30` clientes hardcodeado.
- **Solución:**
  - Actualizar `UpgradeModal.tsx` para listar las características precisas por plan con sus respectivos badges y CTA inteligentes.
  - Agregar banner de cuota de cuentas en `GestionCuentas.tsx` para usuarios Starter (`X de 5 cuentas utilizadas`).

---

## 4. Matriz de Permisos y Rutas por Nivel

| Capacidad / Ruta | Starter (Free) | Professional ($) | Enterprise (3358) | Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard (`/`)** | ✅ Desbloqueado | ✅ Desbloqueado | ✅ Desbloqueado | ✅ (Panel SaaS) |
| **Límite de Clientes** | 20 clientes | Ilimitado | Ilimitado | Ilimitado |
| **Límite de Cuentas Streaming** | 5 cuentas | Ilimitado | Ilimitado | Ilimitado |
| **Gestión de Cuentas (`/cuentas`)** | ✅ Habilitado | ✅ Habilitado | ✅ Habilitado | ❌ (Retail aislado) |
| **Ventas Simples y Combos** | ✅ Habilitado | ✅ Habilitado | ✅ Habilitado | ❌ |
| **Tickets WhatsApp / CSV** | ✅ Habilitado | ✅ Habilitado | ✅ Habilitado | ❌ |
| **Bot Telegram (`/telegram`)** | 🔒 Bloqueado (Pro) | ✅ Habilitado | ✅ Habilitado | ✅ (Alertas) |
| **Reportes Avanzados (`/reportes`)** | 🔒 Bloqueado (Pro) | ✅ Habilitado | ✅ Habilitado | ❌ |
| **Consulta Códigos OTP (`/consulta-codigos`)** | 🔒 Bloqueado (Enterprise)| 🔒 Bloqueado (Enterprise) | ✅ Habilitado | ❌ |
| **Ventas Mayoristas (`/mayoristas`)** | 🔒 Bloqueado (Enterprise)| 🔒 Bloqueado (Enterprise) | ✅ Habilitado | ❌ |
| **Links de Consulta Pública (`/r/:token`)** | ❌ | ❌ | ✅ Habilitado | ✅ |

---

## 5. Conclusión de la Exploración

La reestructuración PLG elimina todas las fricciones de onboarding que causaban churn inmediato en nuevos registros, desbloquea el Dashboard y el inventario básico para que el usuario experimente el valor real de inmediato, y establece una escalera de valor comercial lógica y apetecible para incentivar el upgrade a Professional y Enterprise.
