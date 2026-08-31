# Exploración: Mejoras de Flujos y Ventas Mayoristas en StreamControl

**Fecha:** 2026-08-30  
**Rama:** `feature/mejoras-flujos-y-ventas-mayoristas`  
**Autor:** Senior Architect  
**Estado:** Exploración completada  

---

## 1. Contexto y Objetivos

StreamControl es una plataforma SaaS para la gestión de cuentas de streaming, control de suscripciones, clientes y códigos de verificación IMAP. El presente cambio busca resolver fricciones operativas identificadas en los flujos diarios de los vendedores y desacoplar la gestión mayorista de la consulta de códigos.

### Objetivos Clave:
1. **Visualización de Plataformas:** Identificación visual consistente e intuitiva de cada plataforma de streaming en listados y modales, con soporte robusto para ventas combinadas (combos multi-servicio).
2. **Fix de Renovación en Clientes:** Eliminar la pérdida de asignación al renovar un cliente, permitiendo preseleccionar y conservar la cuenta y perfil asignados en el formulario de ventas.
3. **Unificación de Ticket:** Estandarizar la generación de tickets entre Clientes y Cuentas bajo una plantilla común, con regla estricta de no inventar datos ausentes (PINes o perfiles no definidos).
4. **Claridad en Cuentas (Mayorista vs Servicio):** Separar conceptualmente la "Plataforma / Servicio" (ej. Netflix, Disney) del "Proveedor Mayorista" (quien suministró la cuenta), actualizando tipos, formularios y vistas.
5. **Módulo Dedicado de Ventas Mayoristas:** Extraer la generación de links y gestión de sub-distribuidores de `ConsultaCodigos.tsx` hacia una vista dedicada e intuitiva en `/mayoristas`.

---

## 2. Diagnóstico del Estado Actual

### 2.1 Visualización de Plataformas y Combos
- **Estado Actual:** En `GestionClientes.tsx` y `Reportes.tsx`, la plataforma se renderiza como un texto estático dentro de un badge genérico `bg-indigo-100 text-indigo-700`. En ventas combinadas, la cadena es `"Netflix + Disney premium + Max"`, lo que provoca texto desbordado o ilegible sin diferenciación de marca.
- **Archivos Clave:** `src/pages/GestionClientes.tsx`, `src/pages/Reportes.tsx`, `src/constants/index.ts`.
- **Hallazgo:** No existe un componente centralizado de badges de plataformas ni un mapa de colores/iconos por servicio.

### 2.2 Flujo de Renovación de Clientes
- **Estado Actual:** Al pulsar "Renovar" en `GestionClientes.tsx`, se ejecuta `navigate('/ventas', { state: { cliente: c } })`. En `Ventas.tsx`, se consulta la última venta por nombre pero no se inyecta `cuentaId` ni `perfilAsignado` en `initialData` hacia `VentasForm`.
- **Bloqueo en `SelectorCuenta.tsx`:** La lista `cuentasDisponibles` filtra `c.estado === 'disponible'`, por lo que si una cuenta ya tiene perfiles ocupados o está asignada al cliente que renueva, desaparece del selector. Asimismo, `perfilesDisponibles` filtra `p.estado === 'disponible'`, ocultando el perfil que el cliente ya tenía asignado.
- **Archivos Clave:** `src/pages/GestionClientes.tsx`, `src/pages/Ventas.tsx`, `src/components/VentasForm.tsx`, `src/components/SelectorCuenta.tsx`.

### 2.3 Generación de Tickets
- **Estado Actual:** 
  - En `GestionClientes.tsx`: Usa `TicketModal.tsx` que estructura servicios con formato `📋 *Datos de {cliente.nombre}*`, correo, contraseña, perfil, PIN y enlace.
  - En `GestionCuentas.tsx`: La opción se llama "Copiar datos" y abre un modal improvisado que concatena texto plano con sintaxis distinta.
- **Riesgo:** Inconsistencia de formato y riesgo de mostrar valores undefined o datos simulados si la cuenta no cuenta con PIN o perfil definido.
- **Archivos Clave:** `src/pages/GestionCuentas.tsx`, `src/components/TicketModal.tsx`, `src/pages/GestionClientes.tsx`.

### 2.4 Registro de Cuentas: Plataforma vs Mayorista
- **Estado Actual:** En `src/types/cuenta.ts`, el campo `proveedor` almacena la plataforma (`'Netflix'`, `'Max'`, `'Disney+'`, etc.). En `CuentaForm.tsx`, la etiqueta es "Proveedor", lo que confunde a los usuarios entre el servicio técnico de streaming y el proveedor comercial que les vendió la cuenta.
- **Archivos Clave:** `src/types/cuenta.ts`, `src/components/CuentaForm.tsx`, `src/pages/GestionCuentas.tsx`, `src/components/CuentaDetail.tsx`.

### 2.5 Desacople de Consulta de Códigos y Ventas Mayoristas
- **Estado Actual:** `ConsultaCodigos.tsx` contiene tres pestañas: `directo` (IMAP directo), `link` (generar enlace para sub-distribuidor con cálculo de perfiles/márgenes) y `links` (tabla de tokens para distribuidores).
- **Problema de Arquitectura:** Mezcla la utilidad de consulta técnica con el flujo comercial mayorista. La navegación principal no ofrece acceso directo a ventas mayoristas.
- **Archivos Clave:** `src/pages/ConsultaCodigos.tsx`, `src/App.tsx`, `src/components/Layout.tsx`.

---

## 3. Estrategia y Solución Técnica Propuesta

| Requerimiento | Solución Técnica | Componentes / Módulos Afectados |
|---|---|---|
| **1. Visualización de Plataformas** | Crear `PlataformaBadge.tsx` con paleta de colores/estilos por servicio y función `parsePlataformas(str)` para renderizar grupos de badges limpios en combos. | `src/components/PlataformaBadge.tsx`, `src/pages/GestionClientes.tsx`, `src/pages/Reportes.tsx` |
| **2. Fix de Renovación** | Enviar `cuentaId` y `perfilNombre` desde `GestionClientes` -> `Ventas` -> `VentasForm` -> `SelectorCuenta`. Permitir en `SelectorCuenta` que `c.id === initialCuentaId` y `p.nombre === initialPerfil` permanezcan seleccionables con etiqueta `(Actual)`. | `src/pages/Ventas.tsx`, `src/components/VentasForm.tsx`, `src/components/SelectorCuenta.tsx` |
| **3. Generar Ticket Unificado** | Renombrar "Copiar datos" a "Generar ticket" en `GestionCuentas.tsx`. Adaptar/Reutilizar la plantilla limpia de tickets omitiendo estrictamente campos vacíos o inexistentes. | `src/pages/GestionCuentas.tsx`, `src/components/TicketModal.tsx` |
| **4. Plataforma vs Mayorista** | Renombrar label a "Plataforma / Servicio". Agregar campo opcional `nombreProveedor?: string` (o `proveedorMayorista`) a `Cuenta` y mostrarlo en tablas y detalle de cuentas. | `src/types/cuenta.ts`, `src/components/CuentaForm.tsx`, `src/pages/GestionCuentas.tsx`, `src/components/CuentaDetail.tsx` |
| **5. Módulo Mayoristas** | Crear página `src/pages/VentasMayoristas.tsx` con tabs "Nueva Venta Mayorista" y "Ventas Mayoristas Activas", registrar ruta `/mayoristas` en `App.tsx` y agregar enlace en `Layout.tsx`. Limpiar `ConsultaCodigos.tsx` para foco exclusivo en IMAP. | `src/pages/VentasMayoristas.tsx`, `src/pages/ConsultaCodigos.tsx`, `src/App.tsx`, `src/components/Layout.tsx` |

---

## 4. Matriz de Riesgos y Mitigación

1. **Compatibilidad con datos existentes en Firestore:**
   - *Riesgo:* Modificar el tipo `Cuenta` podría romper lecturas si se renombra la propiedad `proveedor` en la base de datos.
   - *Mitigación:* Se preserva el campo `proveedor` en base de datos para la plataforma (Netflix, etc.) y solo se renombra a nivel de UI como "Plataforma / Servicio", agregando el nuevo campo opcional `nombreProveedor` para el mayorista.
2. **Asignación duplicada de perfiles en renovaciones:**
   - *Riesgo:* Al renovar una cuenta que ya pertenecía al cliente, sobrescribir erróneamente los estados de otros perfiles.
   - *Mitigación:* Se valida que el perfil pertenezca a la cuenta y se preserva el estado de asignación existente sin desasignar perfiles de terceros.
3. **Rutas y navegación:**
   - *Riesgo:* Romper enlaces previos a `/consulta-codigos`.
   - *Mitigación:* `/consulta-codigos` sigue activo para la consulta técnica directa; `/mayoristas` y `/revendedores` se agregan como rutas independientes.
