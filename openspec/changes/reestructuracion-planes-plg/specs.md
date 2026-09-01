# Especificaciones Técnicas: Reestructuración de Planes y Estrategia PLG

**Identificador:** `reestructuracion-planes-plg`  
**Fecha:** 2026-09-01  
**Autor:** Senior Architect  
**Estado:** Especificación aprobada para SDD  

---

## 1. Requerimientos Funcionales

### REQ-001: Desbloqueo Universal del Dashboard Retail (`/`)
- **Descripción:** Todos los usuarios autenticados con rol `usuario` deben tener acceso irrestricto al Dashboard de ventas retail (`/`), independientemente de su plan de suscripción (Starter, Professional o Enterprise).
- **Detalle Técnico:**
  - En `src/pages/Dashboard.tsx`, remover la condición que bloqueaba la vista cuando `!permisos.puedeVerDashboardEjecutivo`.
  - El Dashboard debe mostrar:
    - Métricas financieras: Ingresos, Egresos, Utilidad del mes.
    - Gráfico de barras: Top 5 Clientes por Ventas.
    - Gráfico de pie: Top 5 Plataformas por pantallas vendidas.
    - Tablas de resumen: Clientes destacados y Plataformas populares.
  - Los usuarios con `rol: 'admin'` continúan siendo dirigidos a `AdminDashboard.tsx`.

### REQ-002: Refactorización y Defaults del Motor de Permisos (`usePermisos.ts` y `planFeatures.ts`)
- **Descripción:** Extender el modelo de permisos para gobernar las cuotas de clientes e inventario de cuentas streaming, garantizando defaults funcionales para nuevos usuarios.
- **Detalle Técnico:**
  - Extender la interfaz `Permisos`:
    ```typescript
    export interface Permisos {
      planNombre: string | null;
      loading: boolean;
      clienteLimit: number;      // Starter: 20, Pro: Infinity, Enterprise: Infinity
      cuentaLimit: number;       // Starter: 5, Pro: Infinity, Enterprise: Infinity
      puedeUsarTelegram: boolean;
      puedeVerReportesAvanzados: boolean;
      puedeExportarExcel: boolean;
      puedeVerDashboardEjecutivo: boolean;
      tieneSoportePrioritario: boolean;
      tieneSoporte247: boolean;
      puedeGestionarCuentas: boolean;
      puedeGenerarTokens: boolean;
    }
    ```
  - Configurar `DEFAULT_PERMISOS`:
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
  - Matriz de `PLAN_FEATURES`:
    - **Starter:** `clienteLimit: 20`, `cuentaLimit: 5`, `puedeGestionarCuentas: true`, `puedeExportarExcel: true`, `puedeVerDashboardEjecutivo: true`. Resto `false`.
    - **Professional:** `clienteLimit: Infinity`, `cuentaLimit: Infinity`, `puedeUsarTelegram: true`, `puedeVerReportesAvanzados: true`, `puedeExportarExcel: true`, `puedeGestionarCuentas: true`, `tieneSoportePrioritario: true`, `puedeVerDashboardEjecutivo: true`. Resto `false`.
    - **Enterprise:** `clienteLimit: Infinity`, `cuentaLimit: Infinity`, `puedeUsarTelegram: true`, `puedeVerReportesAvanzados: true`, `puedeExportarExcel: true`, `puedeGestionarCuentas: true`, `tieneSoportePrioritario: true`, `tieneSoporte247: true`, `puedeGenerarTokens: true`, `puedeVerDashboardEjecutivo: true`.
  - En `planFeatures.ts`, registrar `FEATURE_LABELS.cuentaLimit = 'Límite de cuentas streaming'`.

### REQ-003: Control y Validación Uniforme de Cuota de Clientes (`clienteLimit`)
- **Descripción:** La creación de ventas (simples o combos) no debe permitir exceder el límite de clientes del plan activo, pero nunca debe bloquear ventas a clientes preexistentes.
- **Detalle Técnico:**
  - En `src/components/VentasForm.tsx`, centralizar la verificación antes de escribir en Firestore:
    1. Si `permisos.clienteLimit === Infinity`, permitir la operación.
    2. Verificar si el cliente ya existe (`doc(db, 'clientes', ${user.uid}_${nombre})`). Si ya existe, permitir la venta sin consumir cupo adicional.
    3. Si el cliente es nuevo: contar los clientes actuales (`countQuery` en `clientes` where `propietarioId == user.uid`).
    4. Si `countSnap.size >= permisos.clienteLimit`: abortar con toast `Alcanzaste el límite de ${permisos.clienteLimit} clientes del plan Starter. Actualizá a Professional para clientes ilimitados.` y abrir el modal de upgrade.
  - Aplicar esta validación en **`handleSubmitSimple`** y en **`handleSubmitMulti`** de forma consistente.

### REQ-004: Control y Validación de Cuota de Cuentas Streaming (`cuentaLimit`)
- **Descripción:** El inventario de cuentas de streaming debe permitir hasta 5 cuentas en plan Starter y cuentas ilimitadas en Professional y Enterprise.
- **Detalle Técnico:**
  - En `src/pages/GestionCuentas.tsx`:
    - Remover la guarda `<FeatureBlocked />` para usuarios Starter.
    - Antes de abrir el modal de registro o ejecutar `handleCrearCuenta`:
      - Si `permisos.cuentaLimit !== Infinity` y `todasLasCuentas.length >= permisos.cuentaLimit`:
        - Mostrar toast informativo: `Alcanzaste el límite de ${permisos.cuentaLimit} cuentas streaming del plan Starter. Actualizá a Professional para inventario ilimitado.`
        - Desplegar `UpgradeModal`.
    - Añadir banner en la parte superior de `/cuentas` para usuarios Starter:
      `Plan Starter — ${todasLasCuentas.length} de ${permisos.cuentaLimit} cuentas registradas. Actualizá a Professional para cuentas ilimitadas.`
  - En `src/components/SelectorCuenta.tsx`:
    - Validar cuota antes de permitir la creación rápida de cuentas desde el selector de ventas.

### REQ-005: Desbloqueo de Gestión de Perfiles e Inventario para Starter
- **Descripción:** Los usuarios en plan Starter deben poder asignar perfiles, contraseñas y PINs a sus ventas para vivir el valor principal del sistema.
- **Detalle Técnico:**
  - `src/components/SelectorCuenta.tsx` debe renderizarse normalmente para Starter (`puedeGestionarCuentas: true`).
  - La asignación automática de perfiles y la generación de tickets con credenciales queda completamente disponible en Starter.

### REQ-006: Gating de Módulos de Automatización (Telegram y Reportes Pro)
- **Descripción:** Mantener la exclusividad de Telegram y Reportes Financieros Avanzados para tiers pagos (Professional y Enterprise).
- **Detalle Técnico:**
  - `src/pages/TelegramConfig.tsx`: Si `!permisos.puedeUsarTelegram`, renderizar `<FeatureBlocked feature="Notificaciones Telegram" plan="Professional" />`.
  - `src/pages/Reportes.tsx`: Si `!permisos.puedeVerReportesAvanzados`, renderizar `<FeatureBlocked feature="Reportes Avanzados" plan="Professional" />`.

### REQ-007: Gating de Automatización OTP IMAP y Mayoristas (Enterprise)
- **Descripción:** La extracción automática de códigos de verificación por IMAP y la venta por lotes con tokens para revendedores son exclusivas del plan Enterprise.
- **Detalle Técnico:**
  - `src/pages/ConsultaCodigos.tsx`: Si `!permisos.puedeGenerarTokens`, renderizar `<FeatureBlocked feature="Consulta de Códigos" plan="Enterprise" />`.
  - `src/pages/VentasMayoristas.tsx`: Si `!permisos.puedeGenerarTokens`, renderizar `<FeatureBlocked feature="Ventas Mayoristas" plan="Enterprise" />`.
  - En `GestionClientes.tsx`, el botón `Generar link` solo se muestra si `permisos.puedeGenerarTokens === true`.

### REQ-008: Modal de Actualización (`UpgradeModal.tsx`) y Gatillos de Conversión
- **Descripción:** El modal de upgrade debe presentar la comparativa precisa de los 3 tiers, destacando los límites y funcionalidades diferenciales con CTAs directos a WhatsApp/Email.
- **Detalle Técnico:**
  - Actualizar `ALL_FEATURE_KEYS` en `UpgradeModal.tsx` para incluir `cuentaLimit`.
  - Formatear `cuentaLimit`: `5 cuentas` vs `Ilimitado`.
  - Formatear `clienteLimit`: `20 clientes` vs `Ilimitado`.
  - Destacar badge "Recomendado" en el plan Professional.

---

## 2. Diagramas de Flujo y Estados (Mermaid)

### 2.1 Flujo de Validación de Cuota en Ventas (Simple y Combo)

```mermaid
flowchart TD
    A[Usuario envía formulario de Venta] --> B{¿Es usuario Admin?}
    B -- Sí --> F[Registrar Venta en Firestore]
    B -- No --> C{¿El cliente ya existe en Firestore?}
    
    C -- Sí (Cliente existente) --> F
    C -- No (Cliente nuevo) --> D{clienteLimit == Infinity?}
    
    D -- Sí (Pro / Enterprise) --> F
    D -- No (Starter) --> E{Total Clientes >= clienteLimit (20)?}
    
    E -- Sí (Límite alcanzado) --> G[Toast de Error de Cuota]
    G --> H[Abrir UpgradeModal Context]
    
    E -- No (Cupo disponible) --> F
    F --> I[Toast Éxito + Actualizar Listas]
```

### 2.2 Flujo de Validación de Cuota en Inventario de Cuentas

```mermaid
flowchart TD
    A[Usuario pulsa + Registrar Cuenta] --> B{cuentaLimit == Infinity?}
    B -- Sí (Pro / Enterprise) --> C[Abrir CuentaForm Modal]
    B -- No (Starter) --> D{Total Cuentas >= cuentaLimit (5)?}
    
    D -- Sí (Límite alcanzado) --> E[Toast: Límite de 5 cuentas alcanzado]
    E --> F[Abrir UpgradeModal]
    
    D -- No (Cupo disponible) --> C
    C --> G[Guardar Cuenta y Perfiles]
```

---

## 3. Criterios de Aceptación (Gherkin Scenarios)

### Escenario 1: Nuevo usuario se registra y experimenta el Momento ¡Aha!
```gherkin
Given un usuario recién registrado sin suscripción previa
When inicia sesión e ingresa a la aplicación
Then aterriza en "/" y visualiza el Dashboard con métricas de ventas desbloqueadas
And puede navegar a "/cuentas" y registrar una cuenta de Netflix con 5 perfiles
When ingresa a "/ventas" y registra su primera venta vinculando el Perfil 1
Then la venta se registra exitosamente sin ningún error de límite
And el Perfil 1 queda asignado al cliente con su respectivo ticket WhatsApp generado
```

### Escenario 2: Usuario Starter alcanza el límite de 20 clientes
```gherkin
Given un usuario en plan Starter con 20 clientes registrados
When intenta registrar una nueva venta para un cliente nuevo "Pedro Gómez"
Then el sistema bloquea el registro mostrando el toast:
"Alcanzaste el límite de 20 clientes del plan Starter. Actualizá a Professional para clientes ilimitados."
And se abre el "UpgradeModal" invitándolo a actualizar a Professional
```

### Escenario 3: Usuario Starter vende a un cliente existente habiendo alcanzado el límite
```gherkin
Given un usuario en plan Starter con 20 clientes registrados
And "Juan Pérez" ya es uno de los 20 clientes existentes
When el usuario registra una nueva venta o renovación para "Juan Pérez"
Then la venta se procesa y guarda exitosamente
Because no se está creando un cliente nuevo que supere el límite
```

### Escenario 4: Usuario Starter en Ventas Combinadas (Combo)
```gherkin
Given un usuario en plan Starter con 20 clientes registrados
When intenta registrar una venta combo (Netflix + Prime) para un cliente nuevo "Carlos Test"
Then el sistema detecta que es un cliente nuevo y bloquea el submit por límite de cuota
And NO permite saltarse la cuota por usar el modo combo
```

### Escenario 5: Usuario Starter alcanza el límite de 5 cuentas streaming
```gherkin
Given un usuario en plan Starter con 5 cuentas streaming registradas en "/cuentas"
When intenta registrar la cuenta #6
Then el sistema muestra un toast informativo de límite de inventario
And dispara el "UpgradeModal" para actualizar a Professional
```

---

## 4. Matriz de Casos de Borde (Edge Cases)

| Caso de Borde | Comportamiento Esperado | Mitigación Técnica |
| :--- | :--- | :--- |
| **Usuario con sesión iniciada pero sin registro en `suscripciones`** | Asignar inmediatamente los permisos de `Starter` con `clienteLimit: 20` y `cuentaLimit: 5`. | `DEFAULT_PERMISOS` inicializado con cuotas de Starter completas. |
| **Cliente nuevo con espacios en blanco en el nombre** | Normalizar con `.trim()` antes de consultar si existe en Firestore para evitar falsos positivos de clientes nuevos. | `nombre.trim()` en clave de documento `${user.uid}_${nombre.trim()}`. |
| **Venta Combo con múltiples perfiles de diferentes cuentas** | Validar la existencia del cliente una sola vez al inicio de `handleSubmitMulti`. | Comprobación unificada previa a la asignación de perfiles. |
| **Usuario Starter que elimina una cuenta existente** | Al eliminar o expirar una cuenta, el conteo de cuentas activas disminuye, liberando cupo para una nueva cuenta hasta el tope de 5. | Conteo dinámico basado en `todasLasCuentas.length`. |
| **Usuario que hace downgrade de Professional a Starter** | Sus clientes y cuentas existentes se preservan intactos, pero no puede crear el cliente #21 ni la cuenta #6. | Validación no destructiva: solo restringe creaciones incrementales. |
