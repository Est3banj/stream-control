# Documento de Diseño: Unificación del Sistema de Diseño Dark SaaS

**Identificador:** `unificacion-diseno-dark-saas`  
**Estado:** Diseño Aprobado para SDD  

---

## 1. Visión y Principios del Diseño

El objetivo principal es transformar StreamControl Pro en una plataforma SaaS moderna, elegante y de grado empresarial que transmita solidez, rendimiento y profesionalismo en cada píxel.

### Principios Rectores:
1. **Jerarquía Visual y Elevación Semántica:** En lugar de sombras pesadas e invasivas, la profundidad se logra mediante capas tonales de `slate` (`slate-950` → `slate-900` → `slate-850` → `slate-800`), bordes sutiles con translucidez (`border-slate-800/80`) y desenfoques (*backdrop blur*).
2. **Acentos Neón Funcionales:** Los colores vivos (índigo, cian, violeta, esmeralda, ámbar, rosa) se utilizan exclusivamente para enfocar la atención del usuario en datos críticos (estados, botones de acción primaria, métricas clave y badges de servicios).
3. **Ergonomía y Legibilidad:** Evitar el negro puro absoluto (`#000000`) para el canvas, utilizando en su lugar `slate-950` (`#020617`), lo que reduce el contraste extremo y previene la fatiga ocular durante jornadas operativas prolongadas.
4. **Cero Fricción ni Regresiones:** El refactor visual debe ser 100% no destructivo respecto al DOM semántico, accesibilidad (`aria-*`, `role`), listeners en tiempo real y pruebas automatizadas.

---

## 2. Árbol de Componentes y Jerarquía de Contenedores

```
App (Router)
 ├── Auth Layouts (Login, Register, VerificarEmail) [Dark SaaS]
 └── Protected Area -> Layout.tsx [Dark SaaS Shell]
      ├── Ambient Light Background (Indigo + Violet 10% Blurs)
      ├── Sidebar (Fixed Mobile / Static Desktop)
      │    ├── Logo + Brand Glow
      │    ├── Navigation Links (Active Pill: bg-indigo-600/20 text-cyan-300)
      │    ├── PWAInstallButton (Sidebar Mode)
      │    └── User Profile Box + Logout Action
      ├── Header (Sticky with Backdrop Blur)
      │    ├── Mobile Brand Identifier
      │    ├── Spacer
      │    ├── NotificationsPanel (Dark Flyout with Tab & Status Badges)
      │    └── Mobile Menu Trigger (Lucide Menu)
      ├── Main Viewport (Max-W-7xl, Animate Fade-In)
      │    ├── Dashboard.tsx
      │    │    ├── Executive KPI Grid (4 or 3 cards with gradient icons)
      │    │    ├── Recharts Dark Visualizations (BarChart & PieChart)
      │    │    └── Top Tables (Destacados & Populares)
      │    ├── GestionClientes.tsx
      │    │    ├── Filter Chips + Search Input + Export Button
      │    │    ├── Admin KPI Aggregates
      │    │    ├── Clients Data Table + Status Badges + DropdownMenu
      │    │    ├── Paginador.tsx
      │    │    └── Modals (Edit, History, Cobro, Link, Ticket, Free Profile)
      │    ├── GestionCuentas.tsx
      │    │    ├── Provider Filter Slider + Status Chips + Search
      │    │    ├── Accounts Data Table + Profile Indicators
      │    │    └── Modals (Register, Detail, Edit, IMAP, Assign, Renew)
      │    ├── Ventas.tsx & VentasForm.tsx
      │    │    ├── Mode Tabs (Single vs Combo)
      │    │    ├── Form Fields + SelectorCuenta + Profile Inputs
      │    │    └── Financial Summary Card (Utility, Price, Costs)
      │    ├── Reportes.tsx (Date Pickers, Type Chips, Data Table, XLSX Export)
      │    ├── VentasMayoristas.tsx (Tabs, Token Generation, Active Tokens Table)
      │    ├── ConsultaCodigos.tsx (Provider selector, Case picker, CodeResult)
      │    ├── Usuarios.tsx (User creation form, Operator table, Subscriptions)
      │    ├── AdminPlanes.tsx & PlanForm.tsx (WhatsApp config, Plan Cards, Modal)
      │    ├── AdminSuscripciones.tsx & SuscripcionCard.tsx (Filters, Cards, Create)
      │    ├── Ajustes.tsx (Profile info, Currency picker, Credentials modals)
      │    └── TelegramConfig.tsx (Connection guide, 6-digit code box, Modal)
      ├── PWAInstallButton (Floating Toast Mode)
      ├── Floating WhatsApp Support Button (Tooltipped)
      └── UpgradeModal.tsx (Global Dialog triggered by context or expiry)
```

---

## 3. Matriz de Tokens y Equivalencias Visuales

A continuación se detalla la correspondencia entre los estilos claros heredados y la nueva especificación Dark SaaS:

| Elemento / Componente | Estilo Claro Heredado | Nuevo Estilo Dark SaaS |
| :--- | :--- | :--- |
| **Canvas / Background** | `bg-gradient-to-br from-indigo-50 via-white to-cyan-50` | `bg-slate-950 text-slate-100` + Luces ambientales `indigo-600/10` / `violet-600/10` |
| **Tarjetas Principales (.card)** | Fondo blanco translúcido con sombra azul lechosa | `bg-slate-900/75 border border-slate-800/80 backdrop-blur-xl shadow-xl hover:border-slate-700/80` |
| **Header del Sidebar** | Degradado azul oscuro saturado con opacidades blancas | `bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/80` con textos en `slate-200` y acento `cyan-300` |
| **Header Superior** | `glass-strong border-b border-white/40` | `bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 text-slate-100` |
| **Encabezados de Tabla (Thead)** | `bg-indigo-600 text-white` o fondos claros | `bg-slate-900/90 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs` |
| **Filas de Tabla (Tbody Tr)** | `border-b border-gray-100 hover:bg-indigo-50/30` | `border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors text-slate-200` |
| **Inputs, Selects, Textareas** | `border-gray-200 bg-white/80 text-gray-900` | `bg-slate-900/80 border border-slate-700/70 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20` |
| **Botón Primario (.btn-primary)** | `bg-gradient-to-r from-purple-700 to-cyan-500` | `bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-950/50 hover:from-indigo-500 hover:to-violet-500` |
| **Botón Secundario (.btn-secondary)**| `bg-white/80 text-indigo-700` | `bg-slate-800/80 text-slate-200 border border-slate-700/80 hover:bg-slate-700 hover:text-white` |
| **Badges de Plataformas** | `bg-red-50 text-red-600 border-red-200` (etc.) | `bg-red-950/50 text-red-400 border-red-800/50` (etc.) |
| **Modales & Diálogos** | `bg-black/50` con contenedor `bg-white` | Overlay `bg-black/75 backdrop-blur-md` con contenedor `bg-slate-900 border border-slate-800 shadow-2xl text-slate-100` |
| **Dropdown Menus** | `bg-white border-gray-200 shadow-lg` | `bg-slate-900 border border-slate-800 shadow-2xl text-slate-200` |
| **Scrollbars** | Pista gris `bg-gray-100` con pulgar violeta claro | Pista `bg-slate-900` con pulgar `from-indigo-600 to-violet-600` |

---

## 4. Patrón de Gráficos Recharts en Dark Mode

Para asegurar que las visualizaciones en `Dashboard.tsx` no sufran pérdida de contraste ni distorsión cromática, se aplica la siguiente configuración:

1. **Rejilla Cartesiana:** `<CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />`
2. **Ejes X e Y:** `<XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />`
3. **Tooltip Flotante:**
```tsx
<Tooltip
  contentStyle={{
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderRadius: '0.75rem',
    color: '#f8fafc',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
  }}
  itemStyle={{ color: '#818cf8', fontWeight: 600 }}
  labelStyle={{ color: '#e2e8f0', fontWeight: 700, marginBottom: '0.25rem' }}
  formatter={(value: any) => [formatear(value), 'Ventas']}
/>
```
4. **Paleta de Colores de Sectores (Pie Chart):**
```ts
const COLORS = ['#6366f1', '#38bdf8', '#a855f7', '#34d399', '#f43f5e'];
```

---

## 5. Patrón de Formularios y Estados de Validación

Todos los formularios interactivos (`VentasForm`, `CuentaForm`, `PlanForm`, `ConfigurarIMAP`, `EditarClienteModal`, `Ajustes`, etc.) adoptan el patrón de inputs oscuros unificados:

1. **Estructura de Campo:**
```tsx
<div>
  <label className="block text-sm font-medium text-slate-300 mb-1.5">
    Nombre del campo <span className="text-rose-400">*</span>
  </label>
  <input
    type="text"
    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
  />
</div>
```
2. **Autocompletado de Navegador:**
Regla en `src/index.css` para anular el fondo blanco que inyecta Chrome/Safari al autocompletar credenciales:
```css
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px #0f172a inset !important;
  -webkit-text-fill-color: #f8fafc !important;
  caret-color: #38bdf8 !important;
}
```

---

## 6. Manejo de Diálogos y Modales Accesibles

Cada modal de la plataforma sigue el estándar:
1. **Overlay con Bloqueo de Scroll:** `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md`.
2. **Contenedor con Animación de Escala:** `bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in`.
3. **Cierre Accesible:** Tecla `Escape` habilitada, botón de cierre `aria-label="Cerrar"` con icono `X` en `text-slate-400 hover:text-slate-200`.
4. **Header y Footer Fijos (*Sticky*):** Permiten navegar formularios extensos en pantallas móviles manteniendo las acciones visibles.
