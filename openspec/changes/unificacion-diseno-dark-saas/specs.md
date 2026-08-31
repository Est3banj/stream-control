# Especificaciones Técnicas: Unificación del Sistema de Diseño Dark SaaS

**Identificador:** `unificacion-diseno-dark-saas`  
**Estado:** Especificación Aprobada para SDD  

---

## 1. Tokens de Diseño y Sistema Global de Estilos

### 1.1 Paleta de Superficies y Capas (Elevation Tiers)
El sistema define 4 capas de elevación visual mediante combinaciones de color Slate, opacidad y filtros de desenfoque (*backdrop blur*):

| Capa / Token | Código / Clase Tailwind | Propósito |
| :--- | :--- | :--- |
| **L0 Canvas** | `bg-slate-950` (`#020617`) | Fondo principal de la aplicación con luces ambientales sutiles. |
| **L1 Base Surface** | `bg-slate-900/75 border-slate-800/80 backdrop-blur-xl` | Tarjetas operativas, contenedores de sección y tablas. |
| **L2 Elevated / Popover** | `bg-slate-800/90 border-slate-700/80 backdrop-blur-2xl` | Dropdowns, tooltips, paneles emergentes y submenús. |
| **L3 Modal Overlay & Dialog** | `bg-black/75 backdrop-blur-md` (Overlay) + `bg-slate-900 border-slate-800 shadow-2xl` (Dialog) | Ventanas modales centradas y diálogos de confirmación. |

### 1.2 Paleta de Tipografía y Contraste
- **Encabezados Principales (H1, H2):** `text-white` o gradientes `bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300` con acentos `from-indigo-400 to-violet-400`.
- **Texto Principal / Títulos de Tarjeta:** `text-slate-100`.
- **Texto Secundario / Labels de Formulario:** `text-slate-300`.
- **Texto Terciario / Placeholders / Metadatos:** `text-slate-400`.
- **Microcopy / Ayudas:** `text-slate-500`.

### 1.3 Paleta de Acentos y Estados Funcionales
- **Acento Primario (Brand):** `indigo-500` (`#6366f1`) / `indigo-600` (`#4f46e5`).
- **Acento Secundario (Glow & Highlights):** `violet-500` (`#8b5cf6`) / `cyan-400` (`#22d3ee`).
- **Éxito (Activo, Pagado, Vigente):** `bg-emerald-500/15 text-emerald-400 border-emerald-500/30`.
- **Advertencia (Por vencer, Pendiente):** `bg-amber-500/15 text-amber-400 border-amber-500/30`.
- **Peligro (Vencido, Mora, Revocado, Error):** `bg-rose-500/15 text-rose-400 border-rose-500/30`.
- **Info / Neutro:** `bg-slate-800/80 text-slate-300 border-slate-700/60`.

### 1.4 Variables CSS Globales (`src/index.css`)
```css
:root {
  --bg-canvas: #020617;
  --bg-card: rgba(15, 23, 42, 0.75);
  --border-subtle: rgba(30, 41, 59, 0.8);
  --border-highlight: rgba(99, 102, 241, 0.3);
  --gradient-primary: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  --shadow-dark-glass: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
}

body {
  @apply font-inter bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-indigo-500/30 selection:text-indigo-200;
  background-attachment: fixed;
}

.glass {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-dark-glass);
}

.glass-strong {
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(51, 65, 85, 0.8);
}

.card {
  @apply glass rounded-2xl p-6 transition-all duration-300;
}

.card:hover {
  @apply -translate-y-0.5 border-slate-700/80;
  box-shadow: 0 12px 36px 0 rgba(0, 0, 0, 0.6);
}

.btn-primary {
  @apply px-6 py-3 rounded-xl font-semibold text-white shadow-lg transition-all duration-300;
  background: var(--gradient-primary);
}

.btn-primary:hover {
  @apply transform scale-[1.02] shadow-indigo-950/60 shadow-xl;
  background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
}

.btn-secondary {
  @apply px-6 py-3 rounded-xl font-semibold bg-slate-800/80 text-slate-200 border border-slate-700/80 shadow-md transition-all duration-300;
  backdrop-filter: blur(8px);
}

.btn-secondary:hover {
  @apply bg-slate-700 text-white transform scale-[1.02] border-slate-600;
}
```

---

## 2. Especificación de Componentes del Shell y Navegación

### 2.1 `src/components/Layout.tsx`
- **Contenedor Principal:** `min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative overflow-hidden`.
- **Luces Ambientales:**
  - Radial Glow 1 (Top Left): `w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none absolute -top-40 -left-40`.
  - Radial Glow 2 (Bottom Right): `w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none absolute -bottom-40 -right-40`.
- **Sidebar:**
  - Fondo: `bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/80 text-slate-200`.
  - Logo Box: `w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 p-1.5 flex items-center justify-center`.
  - Branding: `text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300`.
  - Enlaces de Navegación:
    - Estado Inactivo: `text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-xl px-4 py-3 transition-all`.
    - Estado Activo: `bg-indigo-600/20 text-cyan-300 border border-indigo-500/30 shadow-lg shadow-indigo-950/40 scale-105`.
  - Bloque de Usuario: `border-t border-slate-800/80 pt-4`, avatar con `bg-slate-800 text-slate-300`, botón de logout `bg-slate-800/60 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/40 border border-slate-700/50 text-slate-300`.
- **Header Superior:**
  - Sticky Bar: `bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 text-slate-100`.
  - Botón menú móvil: `text-slate-300 hover:bg-slate-800/60`.
- **Botón Flotante WhatsApp:**
  - Tooltip: `bg-slate-900 border border-slate-800 text-slate-200 shadow-xl`.

### 2.2 `src/components/NotificationsPanel.tsx`
- **Botón Notificaciones:** `text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg p-2`.
- **Badge Contador No Leídas:** `bg-rose-500 text-white text-xs font-bold animate-pulse`.
- **Panel Desplegable (Flyout):**
  - Contenedor: `w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden`.
  - Header: `bg-slate-850/90 border-b border-slate-800 text-slate-100 p-4`.
  - Items de Notificación:
    - Vencido / Mora: `bg-rose-950/30 border-l-2 border-rose-500 hover:bg-rose-950/40`.
    - Por Vencer (1 día): `bg-amber-950/30 border-l-2 border-amber-500 hover:bg-amber-950/40`.
    - Próximo (3 días): `bg-slate-800/40 hover:bg-slate-800/70`.
    - Textos: Nombre cliente (`text-slate-100 font-semibold`), plataforma (`text-indigo-300`), fecha (`text-slate-400`), deuda mora (`bg-rose-950/60 text-rose-300 border border-rose-800/50`).

---

## 3. Especificación de Primitivas y Componentes Compartidos

### 3.1 `src/components/PlataformaBadge.tsx`
Actualización de colores para máxima legibilidad en fondo oscuro, manteniendo los textos clave para compatibilidad de tests:

| Plataforma | Estilo Dark SaaS |
| :--- | :--- |
| **Netflix** | `bg-red-950/50 text-red-400 border-red-800/50` |
| **Disney+** | `bg-blue-950/50 text-blue-400 border-blue-800/50` |
| **Max / HBO** | `bg-purple-950/50 text-purple-400 border-purple-800/50` |
| **Prime / Amazon** | `bg-sky-950/50 text-sky-400 border-sky-800/50` |
| **Spotify** | `bg-emerald-950/50 text-emerald-400 border-emerald-800/50` |
| **Crunchyroll** | `bg-orange-950/50 text-orange-400 border-orange-800/50` |
| **ChatGPT / OpenAI** | `bg-teal-950/50 text-teal-400 border-teal-800/50` |
| **Magis / IPTV / Plex** | `bg-indigo-950/50 text-indigo-400 border-indigo-800/50` |
| **Win Sports+** | `bg-amber-950/50 text-amber-400 border-amber-800/50` |
| **Canva** | `bg-rose-950/50 text-rose-400 border-rose-800/50` |
| **Universal / Paramount / Vix** | `bg-cyan-950/50 text-cyan-400 border-cyan-800/50` |
| **Default / Otro** | `bg-slate-800 text-slate-300 border-slate-700` |

*Nota de Compatibilidad:* Se preservan los modificadores semánticos para tests (`text-red-400` / `text-emerald-400` / `text-slate-300`).

### 3.2 `src/components/Paginador.tsx`
- Texto informativo: `text-sm text-slate-400`, valores numéricos `font-medium text-slate-200`.
- Selector de páginas: `bg-slate-900 border-slate-800 text-slate-200 rounded-lg px-2 py-1`.
- Botones de navegación (anterior/siguiente): `bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30`.
- Botón de página activa: `bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-semibold`.
- Botón de página inactiva: `text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800`.

### 3.3 `src/components/DropdownMenu.tsx`
- Botón disparador: `p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors`.
- Menú flotante: `bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 min-w-[200px]`.
- Opciones estándar: `text-slate-300 hover:bg-slate-800/80 hover:text-slate-100`.
- Opciones de peligro: `text-rose-400 hover:bg-rose-950/40 hover:text-rose-300`.

### 3.4 `src/components/TicketModal.tsx`
- Contenedor Modal: `bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg text-slate-100`.
- Header: `bg-slate-900 border-b border-slate-800 px-5 py-4`.
- Ficha de Cliente: `bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-slate-300`.
- Bloques de Servicio: `border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden`.
- Header de Servicio: `bg-indigo-950/40 border-b border-indigo-900/40 text-indigo-300 font-semibold`.
- Filas de Credenciales: `font-mono text-slate-200`.
- Token activo: `bg-cyan-950/30 border border-cyan-800/40 text-cyan-300`.
- Footer: `border-t border-slate-800 bg-slate-900`, Botón Copiar `btn-primary`, Botón Cerrar `btn-secondary`.

### 3.5 `src/components/UpgradeModal.tsx`
- Dialog: `bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-6xl text-slate-100`.
- Toggle de Periodo: Contenedor `bg-slate-950 border border-slate-800 p-1 rounded-xl`, botón activo `bg-indigo-600 text-white`, inactivo `text-slate-400 hover:text-slate-200`.
- Tarjetas de Planes:
  - Plan Estándar: `bg-slate-900/90 border-2 border-slate-800 rounded-2xl p-6`.
  - Plan Recomendado (Professional): `bg-gradient-to-b from-indigo-950/30 to-slate-900 border-2 border-indigo-500 shadow-xl shadow-indigo-950/50`.
  - Plan Actual Badge: `bg-slate-800 text-slate-400 font-semibold py-2.5 px-6 rounded-xl`.
- Tabla Comparativa Completa: `border-slate-800`, filas pares/impares con alternancia sutil, filas con diferencias resaltadas en `bg-indigo-950/30`.

### 3.6 `src/components/FeatureBlocked.tsx`
- Contenedor: `bg-slate-900/80 border border-slate-800 rounded-2xl p-10 text-center`.
- Icono candado: `w-16 h-16 rounded-full bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center mx-auto text-indigo-400`.
- Titular: `text-xl font-bold text-white mb-2`.
- Descripción: `text-slate-400 text-sm max-w-md mx-auto`.
- Badge plan requerido: `bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold`.

---

## 4. Especificación de Vistas Operativas

### 4.1 `src/pages/Dashboard.tsx`
- **Métricas KPI:** Tarjetas en `bg-slate-900/75 border-slate-800/80`, textos `text-slate-400` y cifras numéricas `text-3xl font-bold text-white`.
- **Integración Recharts Dark:**
  - `CartesianGrid`: `stroke="#334155" strokeDasharray="3 3"`.
  - `XAxis` / `YAxis`: `tick={{ fill: '#94a3b8', fontSize: 12 }}`.
  - `Tooltip`: Wrapper con `contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}`.
  - `Bar`: Gradiente o color sólido `#6366f1` con borde redondeado.
  - `Pie`: Paleta de colores neon contrastados (`#6366f1`, `#38bdf8`, `#a855f7`, `#34d399`, `#f43f5e`).
- **Tablas de Clientes y Plataformas Destacadas:**
  - Encabezados de tabla: `bg-slate-850 border-b border-slate-800 text-slate-300`.
  - Filas: `border-b border-slate-800/60 hover:bg-slate-800/40 text-slate-200`.

### 4.2 `src/pages/GestionClientes.tsx`
- **Controles de Filtro & Búsqueda:**
  - Botones de estado (Activos, Inactivos, Todos): `filtro === tipo ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800'`.
  - Input de búsqueda: `bg-slate-900/80 border-slate-800 text-slate-100 placeholder-slate-500`.
- **Tabla Principal de Clientes:**
  - Thead: `bg-slate-900 border-b border-slate-800 text-slate-300 font-semibold`.
  - Tbody: Filas con `border-b border-slate-800/60 hover:bg-slate-800/40`.
  - Badges de Días Restantes:
    - > 7 días: `bg-emerald-950/50 text-emerald-400 border border-emerald-800/40`.
    - 1-7 días: `bg-amber-950/50 text-amber-400 border border-amber-800/40`.
    - Vencido: `bg-rose-950/50 text-rose-400 border border-rose-800/40`.
  - Badge de Saldo: Mora `bg-rose-950/50 text-rose-400 border border-rose-800/40`, Al día `bg-emerald-950/50 text-emerald-400 border border-emerald-800/40`.
  - Badge de Token: Vigente `bg-cyan-950/50 text-cyan-400 border border-cyan-800/40`, Expirado `bg-slate-800 text-slate-400`.
- **Modales:**
  - Editar Cliente: Formulario con campos dark `bg-slate-900/80 border-slate-700 text-slate-100`.
  - Historial de Ventas: Lista de tarjetas de venta en `bg-slate-950/60 border border-slate-800`.
  - Modal de Cobro: Indicador de saldo en `bg-amber-950/30 border border-amber-800/40 text-amber-300`.
  - Modal de Link de Códigos: Cuadro con `bg-slate-950 border border-slate-800 font-mono text-cyan-300`.
  - Confirmación de Liberar Perfil / Revocar Token: Alerta visual con iconos de advertencia en rojo/naranja.

### 4.3 `src/pages/GestionCuentas.tsx` & Componentes Asociados
- **Filtros por Proveedor:** Chips deslizables en `bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800`, seleccionado `bg-indigo-600 text-white`.
- **Cards y Tablas de Cuentas:** Badges de estado (`disponible`, `asignada`, `expirada`) con estilos dark.
- **Componentes Secundarios:**
  - `CuentaDetail.tsx`: Visor de perfiles con grid en `bg-slate-950/60 border border-slate-800`.
  - `CuentaForm.tsx`: Formulario con agregador de perfiles dinámicos y cálculo de fechas en estilo dark.
  - `SelectorCuenta.tsx`: Dropdown y creación rápida de cuenta con soporte modal dark.
  - `ConfigurarIMAP.tsx`: Configuración de credenciales de correo IMAP con inputs protegidos.

### 4.4 `src/pages/Ventas.tsx` & `src/components/VentasForm.tsx`
- Formulario de Venta Unificada (Simple vs Combinada):
  - Tabs de modo de venta: Botones `bg-slate-900 border border-slate-800`, activo `bg-indigo-600 text-white`.
  - Lista de Servicios en Venta Combinada: Tarjetas individuales en `bg-slate-950/70 border border-slate-800`.
  - Indicadores de Utilidad y Precios: Resumen financiero en `bg-emerald-950/20 border border-emerald-800/40 text-emerald-300`.

---

## 5. Especificación de Vistas Especializadas y Administrativas

- **`Reportes.tsx`:** Inputs de rango de fechas con calendario nativo dark, filtros de subdistribuidor, tabla de transacciones dark y botón de exportación CSV/Excel.
- **`VentasMayoristas.tsx`:** Selector de perfiles múltiple en `bg-slate-950 border-slate-800`, cálculo automático de costos y márgenes, tabla de tokens con botón de copia rápida y revocación.
- **`ConsultaCodigos.tsx`:** Visor de códigos con números monoespaciados en `text-amber-400`, enlaces con botón "Abrir enlace" y temporizador de expiración.
- **`Usuarios.tsx`:** Tabla de operadores con badges de rol (`admin` vs `usuario`) y verificación de email (`Verificado` verde vs `No verificado` gris), modal para asignar y renovar suscripciones.
- **`AdminPlanes.tsx` & `PlanForm.tsx`:** Configuración de WhatsApp comercial, grilla de planes activos con toggle switch y modal para crear/editar planes.
- **`AdminSuscripciones.tsx` & `SuscripcionCard.tsx`:** Filtros por estado (`activa`, `expirada`, `cancelada`) y estado de pago (`pagado`, `pendiente`, `vencido`), modal de creación de suscripción.
- **`Ajustes.tsx` & `TelegramConfig.tsx`:** Perfil de usuario, selector de moneda con bandera y tasa, modales de cambio de correo y contraseña, y flujo de vinculación de bot de Telegram.

---

## 6. Criterios de Aceptación y Calidad (QA Acceptance Criteria)

1. **Compilación Limpia:** `npm run typecheck` ejecuta `tsc --noEmit` sin errores de tipado en frontend ni backend.
2. **Suite de Tests 100% Pasando:** `npm test` (`vitest run`) ejecuta los 19 archivos de prueba y 140+ casos de prueba sin fallos.
3. **Contraste y Accesibilidad:** Todos los textos y botones cumplen con el ratio mínimo de contraste WCAG AA (4.5:1 para texto normal, 3:1 para encabezados grandes y badges).
4. **Preservación de Lógica y Firestore:** Cero alteraciones en las mutaciones de datos (`addDoc`, `updateDoc`, `setDoc`), queries de Firestore, hooks ni callbacks de autenticación.
