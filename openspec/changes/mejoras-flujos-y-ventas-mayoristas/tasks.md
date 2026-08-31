# Tareas: Mejoras de Flujos y Ventas Mayoristas

**Identificador:** `mejoras-flujos-y-ventas-mayoristas`  
**Estado:** Completado  

---

## 1. Visualización de Plataformas
- [x] **1.1** Crear componente `src/components/PlataformaBadge.tsx` con estilos temáticos por plataforma (Netflix, Disney+, Max, Prime Video, Spotify, Crunchyroll, ChatGPT, MagisTV, Win Sports+, Canva) y función de partición de combos.
- [x] **1.2** Integrar `PlataformaBadge` en la tabla y modal de historial de `src/pages/GestionClientes.tsx`.
- [x] **1.3** Integrar `PlataformaBadge` en la tabla de ventas de `src/pages/Reportes.tsx`.

## 2. Fix de Renovación en Clientes
- [x] **2.1** Actualizar `src/pages/Ventas.tsx` para propagar `cuentaId` y `perfilNombre` desde el estado del cliente o la última venta en `initialData`.
- [x] **2.2** Actualizar `src/components/VentasForm.tsx` para aceptar `cuentaId` y `perfilNombre` iniciales y transferirlos a `SelectorCuenta`.
- [x] **2.3** Modificar `src/components/SelectorCuenta.tsx` para no excluir la cuenta `initialCuentaId` ni el perfil `initialPerfil` si ya están asignados al cliente que renueva.

## 3. Generar Ticket Unificado
- [x] **3.1** Renombrar "Copiar datos" a "Generar ticket" en las acciones y modales de `src/pages/GestionCuentas.tsx`.
- [x] **3.2** Estandarizar la plantilla de texto del ticket con la misma estructura que `TicketModal.tsx`, omitiendo estrictamente campos vacíos o perfiles/PINes inexistentes.

## 4. Registrar Cuenta: Plataforma vs Mayorista
- [x] **4.1** Actualizar `src/types/cuenta.ts` incorporando el campo opcional `nombreProveedor?: string`.
- [x] **4.2** Modificar `src/components/CuentaForm.tsx` renombrando el label a "Plataforma / Servicio *" y agregando el input opcional "Nombre del Proveedor (Mayorista)".
- [x] **4.3** Actualizar `src/pages/GestionCuentas.tsx` y `src/components/CuentaDetail.tsx` para reflejar el proveedor mayorista en la tabla y en el modal de detalle.

## 5. Módulo Dedicado de Ventas Mayoristas
- [x] **5.1** Crear la vista `src/pages/VentasMayoristas.tsx` con pestañas "Nueva Venta Mayorista" y "Ventas Mayoristas Activas", y botón de acción directa.
- [x] **5.2** Limpiar `src/pages/ConsultaCodigos.tsx` para concentrarlo exclusivamente en la consulta técnica de códigos IMAP.
- [x] **5.3** Registrar las rutas `/mayoristas` y `/revendedores` en `src/App.tsx`.
- [x] **5.4** Añadir el enlace "Mayoristas" en la barra de navegación lateral de `src/components/Layout.tsx`.

## 6. Verificación y Calidad
- [x] **6.1** Ejecutar comprobaciones de tipos TypeScript (`tsc --noEmit`).
- [x] **6.2** Ejecutar suite de pruebas (`npm test`) y verificar cobertura de los flujos actualizados.
