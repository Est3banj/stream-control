# Propuesta: Reestructuración de Planes y Estrategia PLG (Product-Led Growth)

**Identificador:** `reestructuracion-planes-plg`  
**Fecha:** 2026-09-01  
**Autor:** Senior Architect  
**Estado:** Propuesta Aprobada para SDD  

---

## 1. Resumen Ejecutivo

StreamControl Pro adopta una estrategia pura de **Product-Led Growth (PLG)** para transformar la adquisición orgánica de revendedores de streaming en un motor de conversión recurrente predecible y escalable.

> **Objetivo Central:**  
> Garantizar un onboarding de **cero fricción** donde cualquier nuevo usuario registrado experimente inmediatamente el valor central (**Momento ¡Aha!**) al registrar sus primeras ventas y cuentas de streaming, estableciendo al mismo tiempo barreras de crecimiento naturales y atractivas (*upgrade triggers*) que motiven la transición fluida a los planes de pago **Professional** y **Enterprise**.

### Principales Transformaciones
1. **Desbloqueo Inmediato del Dashboard (`/`):** Se elimina el bloqueo erróneo de `<FeatureBlocked />` para que los usuarios Starter y Professional vean sus métricas de ventas, ingresos, egresos y utilidad sin trabas.
2. **Corrección de Cuota Inicial (`DEFAULT_PERMISOS`):** Se eleva la cuota por defecto de nuevos registros de `clienteLimit: 0` a `clienteLimit: 20` y `cuentaLimit: 5`, erradicando el bloqueo de la primera venta.
3. **Desbloqueo de Gestión de Cuentas (`/cuentas` y `SelectorCuenta`):** Los usuarios Starter pueden crear hasta 5 cuentas madre en inventario y vincular perfiles con PINs en sus ventas.
4. **Validación Uniforme de Cuotas:** Aplicación estricta y consistente de límites de clientes y cuentas en ventas simples, ventas combinadas (combos) y módulo de inventario.
5. **Propuesta de Valor y Escalera de Monetización Cristalina:**
   - **Starter ($0/mes):** 20 clientes, 5 cuentas, Dashboard completo, ventas simples/combo, tickets WhatsApp, CSV.
   - **Professional ($X/mes):** Clientes y cuentas ilimitadas, Bot de Telegram 24/7 con recordatorios preventivos de vencimiento y mora, Reportes Financieros Avanzados con filtros por fecha, Soporte prioritario.
   - **Enterprise ($Y/mes):** Automatización de códigos OTP IMAP (Netflix/Disney/Max/etc.), Módulo de ventas mayoristas y sub-distribuidores (`/mayoristas`), generación de tokens y links de consulta pública (`/r/:token`), Soporte VIP 24/7.

---

## 2. Personas y Casos de Uso (User Stories)

### 2.1 Persona 1: Revendedor Principiante (Plan Starter - Free)
- **Perfil:** Persona que inicia vendiendo pantallas a amigos y conocidos (1 a 15 clientes).
- **Dolor:** Quiere probar la plataforma sin pagar por adelantado para confirmar que le ahorra tiempo en la entrega de perfiles y recordatorios de cobro.
- **Historias de Usuario:**
  - **US-01:** *Como* usuario recién registrado, *quiero* ingresar al Dashboard y ver mis métricas financieras sin bloqueos, *para* tener visibilidad de mis números.
  - **US-02:** *Como* revendedor principiante, *quiero* registrar mi primera venta y guardar mi primera cuenta de Netflix con perfiles, *para* experimentar la asignación automática y generar tickets de WhatsApp inmediatamente.
  - **US-03:** *Como* usuario del plan Starter, *quiero* ver un indicador claro de cuántos clientes y cuentas he utilizado (ej. 14 de 20 clientes), *para* saber cuándo mi negocio está listo para dar el salto al plan Pro.

### 2.2 Persona 2: Revendedor Individual Profesional (Plan Professional - Pro)
- **Perfil:** Revendedor consolidado con 30 a 200 clientes que gestiona múltiples cuentas y necesita automatizar su rutina diaria.
- **Dolor:** Pierde horas revisando manualmente quién vence cada día y respondiendo mensajes de cobro; sufre cuando supera los 20 clientes.
- **Historias de Usuario:**
  - **US-04:** *Como* revendedor Pro, *quiero* registrar clientes y cuentas ilimitadas, *para* no tener techos artificiales en el crecimiento de mis ingresos.
  - **US-05:** *Como* revendedor Pro, *quiero* conectar mi bot de Telegram (@NotiStream_bot), *para* recibir alertas automáticas 3, 2 y 1 día antes de cada vencimiento y alertas de mora matutinas.
  - **US-06:** *Como* revendedor Pro, *quiero* consultar reportes financieros filtrados por fecha y tipo de venta, *para* conciliar mis utilidades mensuales y exportar balances a Excel.

### 2.3 Persona 3: Distribuidor Mayorista / Agencia (Plan Enterprise)
- **Perfil:** Proveedor que vende cuentas completas y perfiles por volumen a otros revendedores o maneja una base masiva de usuarios finales.
- **Dolor:** Soporte colapsado por solicitudes constantes de códigos de verificación OTP (Hogar Netflix, Viaje, códigos Disney+) y falta de control sobre revendedores.
- **Historias de Usuario:**
  - **US-07:** *Como* mayorista Enterprise, *quiero* que el sistema consulte automáticamente los códigos OTP de mis cuentas vía IMAP, *para* no tener que abrir correos manualmente cada 5 minutos.
  - **US-08:** *Como* mayorista Enterprise, *quiero* generar links de consulta pública (`/r/:token`) o registrar ventas mayoristas en `/mayoristas`, *para* que mis sub-distribuidores y clientes consulten sus códigos de forma autónoma.

---

## 3. Gatillos de Actualización (Upgrade Triggers) y Métricas de ROI

El modelo PLG se basa en crear fricción positiva: el usuario actualiza porque su propio éxito comercial lo justifica económicamente.

```
+----------------------------------------------------------------------------------------------------+
|                                  ESCALERA DE CONVERSIÓN Y ROI                                      |
|                                                                                                    |
|  [ STARTER (0 a 20 clientes) ]                                                                     |
|         │                                                                                          |
|         ├── GATILLO 1: Cliente #21 alcanzado --> Modal: "Tu negocio está creciendo"                |
|         ├── GATILLO 2: Cuenta #6 alcanzada   --> Modal: "Inventario ilimitado"                     |
|         ├── GATILLO 3: Clic en Telegram      --> Modal: "Ahorra 1.5 horas diarias de cobranza"      |
|         ▼                                                                                          |
|  [ PROFESSIONAL (21 a 150+ clientes) ]                                                             |
|         │                                                                                          |
|         ├── GATILLO 4: Clic en Consulta Códigos OTP --> Modal: "Automatiza códigos Netflix Hogar"  |
|         ├── GATILLO 5: Clic en Mayoristas / Tokens  --> Modal: "Vende lotes a revendedores"        |
|         ▼                                                                                          |
|  [ ENTERPRISE (Operación Mayorista / Agencias) ]                                                   |
+----------------------------------------------------------------------------------------------------+
```

### 3.1 Justificación Económica (ROI del Usuario)
1. **Starter a Professional ($X/mes):**
   - Con 20 clientes, el revendedor factura típicamente entre $200.000 y $400.000 COP/mes (o $60 - $120 USD/mes), con un margen neto de 50-60%.
   - El costo del plan Professional representa menos del 5-8% de sus ingresos brutos.
   - El Bot de Telegram le ahorra entre 10 y 15 horas al mes en recordatorios manuales por WhatsApp, evitando fugas de clientes por olvidos de renovación.
2. **Professional a Enterprise ($Y/mes):**
   - Un distribuidor mayorista gestiona decenas de cuentas de Netflix y atiende decenas de solicitudes de códigos al día.
   - La automatización OTP IMAP elimina el 90% del tiempo de soporte y permite vender a sub-distribuidores con links dedicados, aumentando el ticket promedio en más de 300%.

---

## 4. Alcance Detallado de la Intervención

### 4.1 Capa de Permisos y Hooks
1. **`src/hooks/usePermisos.ts`:**
   - Añadir propiedad `cuentaLimit: number` a la interfaz `Permisos`.
   - Modificar `DEFAULT_PERMISOS`:
     ```typescript
     const DEFAULT_PERMISOS: Permisos = {
       planNombre: 'Starter',
       loading: true,
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
     };
     ```
   - Modificar `PLAN_FEATURES`:
     - **Starter:** `clienteLimit: 20`, `cuentaLimit: 5`, `puedeGestionarCuentas: true`, `puedeVerDashboardEjecutivo: true`, `puedeExportarExcel: true`, resto `false`.
     - **Professional:** `clienteLimit: Infinity`, `cuentaLimit: Infinity`, `puedeUsarTelegram: true`, `puedeVerReportesAvanzados: true`, `puedeGestionarCuentas: true`, `puedeExportarExcel: true`, `tieneSoportePrioritario: true`, resto `false`.
     - **Enterprise:** Todo `true` / `Infinity`.
   - Normalizar el fallback cuando el usuario no tiene suscripción activa para asignar el tier Starter con sus cuotas correspondientes (`clienteLimit: 20`, `cuentaLimit: 5`).

2. **`src/hooks/planFeatures.ts`:**
   - Añadir label `cuentaLimit: 'Límite de cuentas streaming'`.
   - Actualizar `PLAN_UPGRADE_TARGET`:
     - `Starter` -> `Professional`
     - `Professional` -> `Enterprise`

### 4.2 Interfaz de Usuario y Vistas
1. **`src/pages/Dashboard.tsx`:**
   - Remover la comprobación `if (!permisos.puedeVerDashboardEjecutivo) return <FeatureBlocked />`.
   - Garantizar que todos los usuarios autenticados con `rol === 'usuario'` vean el Dashboard retail.
2. **`src/components/VentasForm.tsx`:**
   - Refactorizar la validación de cuotas de clientes en una función utilitaria reutilizable.
   - Validar cuota antes del submit tanto en `handleSubmitSimple` como en `handleSubmitMulti`.
   - No bloquear la venta si el cliente ya existe en Firestore (`doc(db, 'clientes', ...).exists()`).
3. **`src/pages/GestionCuentas.tsx` & `src/components/CuentaForm.tsx`:**
   - Remover bloqueo de página entera para Starter.
   - Validar límite de cuentas (`cuentas.length < permisos.cuentaLimit`) antes de registrar una nueva cuenta.
   - Añadir banner informativo para Starter: *Plan Starter — X de 5 cuentas utilizadas. Actualizá a Professional para cuentas ilimitadas.*
4. **`src/components/UpgradeModal.tsx`:**
   - Actualizar tabla de características y tarjetas de planes para mostrar los límites de clientes (20 vs Ilimitado) y cuentas (5 vs Ilimitado).
   - Resaltar la automatización de Telegram en Professional y Códigos IMAP / Mayoristas en Enterprise.

---

## 5. Cambios Disruptivos (Breaking Changes) y Migración

| Cambio | Naturaleza | Impacto | Estrategia de Migración |
| :--- | :--- | :--- | :--- |
| **Ajuste de cuota Starter a 20 clientes** (antes figuraba 30 en tabla estática) | Negocio / Datos | Usuarios existentes en Starter con >20 clientes. | No se eliminan clientes existentes; se bloquea la adición del cliente #21 con invitación a actualizar a Professional. |
| **Desbloqueo de cuentas para Starter** | Funcionalidad | Positivo 100%. Permite a los usuarios Starter usar inventario hasta 5 cuentas. | Retrocompatible y de activación inmediata. |
| **Desbloqueo de Dashboard para Starter y Pro** | Funcionalidad | Positivo 100%. Elimina el candado en `/`. | Retrocompatible y de activación inmediata. |

---

## 6. Riesgos Técnicos y Mitigaciones

1. **Riesgo: Bypass de cuota de clientes en ventas rápidas.**  
   *Mitigación:* Validación pre-submit contra Firestore (`getCountFromServer` o consulta indexada por `propietarioId`) y verificación de duplicados por nombre y teléfono.
2. **Riesgo: Inconsistencia en tests unitarios existentes.**  
   *Mitigación:* Actualizar los mocks de `usePermisos` en `VentasForm.test.tsx`, `UpgradeModal.test.tsx`, `useSuscripciones.test.ts` para incluir `cuentaLimit` y reflejar los nuevos defaults.
