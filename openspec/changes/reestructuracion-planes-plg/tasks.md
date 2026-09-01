# Tareas de Implementación: Reestructuración de Planes y Estrategia PLG

**Identificador:** `reestructuracion-planes-plg`  
**Estado:** Propuesta Aprobada (SDD Phase: Tasks Ready for Apply)  

---

## Fase 1: Motor de Permisos y Definición de Tipos

- [ ] **1.1** Actualizar `src/hooks/usePermisos.ts`:
  - Añadir `cuentaLimit: number` a la interfaz `Permisos`.
  - Actualizar `DEFAULT_PERMISOS` con: `planNombre: 'Starter'`, `clienteLimit: 20`, `cuentaLimit: 5`, `puedeGestionarCuentas: true`, `puedeVerDashboardEjecutivo: true`, `puedeExportarExcel: true`.
  - Actualizar `PLAN_FEATURES`:
    - **Starter:** `clienteLimit: 20`, `cuentaLimit: 5`, `puedeGestionarCuentas: true`, `puedeVerDashboardEjecutivo: true`, `puedeExportarExcel: true`.
    - **Professional:** `clienteLimit: Infinity`, `cuentaLimit: Infinity`, `puedeUsarTelegram: true`, `puedeVerReportesAvanzados: true`, `puedeExportarExcel: true`, `puedeGestionarCuentas: true`, `tieneSoportePrioritario: true`, `puedeVerDashboardEjecutivo: true`.
    - **Enterprise:** `clienteLimit: Infinity`, `cuentaLimit: Infinity`, `puedeUsarTelegram: true`, `puedeVerReportesAvanzados: true`, `puedeExportarExcel: true`, `puedeGestionarCuentas: true`, `tieneSoportePrioritario: true`, `tieneSoporte247: true`, `puedeGenerarTokens: true`, `puedeVerDashboardEjecutivo: true`.
  - Asegurar que cuando no haya suscripción activa, se devuelvan los permisos de Starter completos sin `clienteLimit: 0`.
  - *Commit:* `feat(permisos): update plg plan limits with 20 clients and 5 accounts for starter`

- [ ] **1.2** Actualizar `src/hooks/planFeatures.ts`:
  - Agregar `cuentaLimit: 'Límite de cuentas streaming'` a `FEATURE_LABELS`.
  - Actualizar `PLAN_UPGRADE_TARGET` para reflejar `Starter -> Professional -> Enterprise`.
  - *Commit:* `feat(plan-features): register cuentaLimit label and upgrade targets`

---

## Fase 2: Desbloqueo del Dashboard Retail

- [ ] **2.1** Actualizar `src/pages/Dashboard.tsx`:
  - Remover la guarda `if (!permisos.puedeVerDashboardEjecutivo) return <FeatureBlocked />`.
  - Asegurar que cualquier usuario autenticado con `rol === 'usuario'` visualice las métricas de ingresos, egresos, utilidad, top clientes y plataformas.
  - *Commit:* `feat(dashboard): unlock retail dashboard for starter and professional users`

---

## Fase 3: Desbloqueo de Inventario y Control de Cuota de Cuentas

- [ ] **3.1** Actualizar `src/pages/GestionCuentas.tsx`:
  - Remover el bloqueo inicial `<FeatureBlocked />` para Starter.
  - Validar el límite de cuentas (`cuentas.length < permisos.cuentaLimit`) al pulsar `+ Registrar Cuenta` y en `handleCrearCuenta`.
  - Disparar `toast.error` y `UpgradeModal` cuando un usuario Starter intente registrar su cuenta #6.
  - Agregar banner de cuota en el encabezado para Starter: `X de 5 cuentas utilizadas`.
  - *Commit:* `feat(cuentas): unlock accounts management for starter with 5 accounts quota`

- [ ] **3.2** Actualizar `src/components/SelectorCuenta.tsx`:
  - Permitir la renderización del selector de cuentas para Starter.
  - Validar límite de cuentas al intentar registrar una cuenta nueva inline desde el selector de ventas.
  - *Commit:* `feat(selector-cuenta): enable streaming account profile selector for starter`

---

## Fase 4: Validación Uniforme de Cuota de Clientes

- [ ] **4.1** Actualizar `src/components/VentasForm.tsx`:
  - Implementar verificación de existencia previa de cliente (`doc(db, 'clientes', ${uid}_${nombre})`).
  - Si el cliente es nuevo y `permisos.clienteLimit !== Infinity`: verificar `countSnap.size >= permisos.clienteLimit`.
  - Aplicar la validación tanto en `handleSubmitSimple` como en `handleSubmitMulti` (ventas combo).
  - *Commit:* `feat(ventas): enforce consistent client limit check on single and combo sales`

- [ ] **4.2** Actualizar `src/pages/GestionClientes.tsx`:
  - Actualizar el banner de cuota de Starter para mostrar `X de 20 clientes usados` dinámicamente desde `permisos.clienteLimit`.
  - Añadir botón de "Actualizar a Pro" en el banner.
  - *Commit:* `feat(clientes): update starter quota banner with 20 clients limit`

---

## Fase 5: Rediseño del Modal de Upgrade y Banners PLG

- [ ] **5.1** Actualizar `src/components/UpgradeModal.tsx`:
  - Incluir `cuentaLimit` en `ALL_FEATURE_KEYS`.
  - Formatear `cuentaLimit` (`5 cuentas` vs `Ilimitado`) y `clienteLimit` (`20 clientes` vs `Ilimitado`).
  - Resaltar la automatización de Telegram en Professional y Códigos IMAP / Mayoristas en Enterprise.
  - *Commit:* `feat(upgrade-modal): update feature comparison table with plg quotas`

---

## Fase 6: Pruebas Automatizadas y Verificación de Regresión

- [ ] **6.1** Actualizar y crear pruebas unitarias:
  - `src/hooks/useSuscripciones.test.ts` / `usePermisos.test.ts`: Validar cuotas de Starter (20 clientes, 5 cuentas), Pro (Ilimitado) y Enterprise (Ilimitado).
  - `src/components/VentasForm.test.tsx`: Validar que el primer cliente se registre sin error y que se aplique la cuota en combos.
  - `src/components/UpgradeModal.test.tsx`: Validar renderizado de 20 clientes y 5 cuentas.
  - *Commit:* `test(plg): update unit test suite for plg plan restructuring`

- [ ] **6.2** Verificación completa:
  - Ejecutar `npm run typecheck` (`tsc --noEmit`).
  - Ejecutar `npm test` (`vitest run`).
  - *Commit:* `chore(qa): verify zero typescript errors and all unit tests passing`
