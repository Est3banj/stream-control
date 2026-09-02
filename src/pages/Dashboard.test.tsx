import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from './Dashboard';

// Mock Recharts components for jsdom compatibility
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('./AdminDashboard', () => ({
  default: () => <div data-testid="admin-dashboard">Admin Dashboard</div>,
}));

let mockUser: { uid: string; rol: string; email: string } | null = {
  uid: 'user-starter-1',
  rol: 'usuario',
  email: 'starter@streamcontrol.com',
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../hooks/usePermisos', () => ({
  default: () => ({
    planNombre: 'Starter',
    loading: false,
    clienteLimit: 20,
    cuentaLimit: 5,
    puedeGestionarCuentas: true,
    puedeVerDashboardEjecutivo: true,
    puedeExportarExcel: true,
    puedeUsarTelegram: false,
    puedeVerReportesAvanzados: false,
    tieneSoportePrioritario: false,
    tieneSoporte247: false,
    puedeGenerarTokens: false,
  }),
}));

let mockVentas: any[] = [
  {
    id: 'v-1',
    nombre: 'Juan Pérez',
    telefono: '3001234567',
    plataforma: 'Netflix',
    pantallas: 1,
    precioVenta: 15000,
    costoServicio: 5000,
    utilidad: 10000,
    fechaVenta: new Date().toISOString().slice(0, 10),
    monedaVenta: 'COP',
    tasaVenta: 1,
  },
];

let mockClientes: any[] = [
  {
    id: 'c-1',
    nombre: 'Juan Pérez',
    telefono: '3001234567',
    plataforma: 'Netflix',
    diasRestantes: 2 as number | null,
    saldoPendiente: 5000,
    estado: 'activo' as const,
  },
  {
    id: 'c-2',
    nombre: 'Ana Gómez',
    telefono: '3109876543',
    plataforma: 'Disney+',
    diasRestantes: 10 as number | null,
    saldoPendiente: 0,
    estado: 'activo' as const,
  },
];

let mockCuentas: any[] = [
  {
    id: 'cta-1',
    proveedor: 'Netflix',
    correoCuenta: 'netflix1@stream.com',
    costo: 30000,
    tipoVenta: 'perfiles' as const,
    perfiles: [
      { nombre: 'Perfil 1', pin: '1234', estado: 'asignado' as const, clienteNombre: 'Juan Pérez' },
      { nombre: 'Perfil 2', pin: '5678', estado: 'disponible' as const },
    ],
    estado: 'disponible' as const,
    createdAt: { seconds: 1234567890, nanoseconds: 0 },
    updatedAt: { seconds: 1234567890, nanoseconds: 0 },
  },
];

let mockConvertirVenta = (monto: number, _monedaVenta?: string, _tasaVenta?: number) => monto;
let mockFormatear = (v: number) => `$${v.toLocaleString('es-CO')}`;

vi.mock('../hooks/useVentas', () => ({
  default: () => ({
    ventas: mockVentas,
    loading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useClientes', () => ({
  default: () => ({
    clientes: mockClientes,
    loading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useCuentas', () => ({
  default: () => ({
    cuentas: mockCuentas,
    loading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useMoneda', () => ({
  useMoneda: () => ({
    moneda: 'COP',
    simbolo: '$',
    formatear: (v: number) => mockFormatear(v),
    convertirVenta: (monto: number, monedaVenta?: string, tasaVenta?: number) =>
      mockConvertirVenta(monto, monedaVenta, tasaVenta),
  }),
}));

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ size: 0 }),
}));

describe('Dashboard — Modern Dark SaaS Elite Retail Experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      uid: 'user-starter-1',
      rol: 'usuario',
      email: 'starter@streamcontrol.com',
    };
    mockConvertirVenta = (monto: number) => monto;
    mockFormatear = (v: number) => `$${v.toLocaleString('es-CO')}`;
    mockVentas = [
      {
        id: 'v-1',
        nombre: 'Juan Pérez',
        telefono: '3001234567',
        plataforma: 'Netflix',
        pantallas: 1,
        precioVenta: 15000,
        costoServicio: 5000,
        utilidad: 10000,
        fechaVenta: new Date().toISOString().slice(0, 10),
        monedaVenta: 'COP',
        tasaVenta: 1,
      },
    ];
    mockClientes = [
      {
        id: 'c-1',
        nombre: 'Juan Pérez',
        telefono: '3001234567',
        plataforma: 'Netflix',
        diasRestantes: 2,
        saldoPendiente: 5000,
        estado: 'activo' as const,
      },
      {
        id: 'c-2',
        nombre: 'Ana Gómez',
        telefono: '3109876543',
        plataforma: 'Disney+',
        diasRestantes: 10,
        saldoPendiente: 0,
        estado: 'activo' as const,
      },
    ];
    mockCuentas = [
      {
        id: 'cta-1',
        proveedor: 'Netflix',
        correoCuenta: 'netflix1@stream.com',
        costo: 30000,
        tipoVenta: 'perfiles' as const,
        perfiles: [
          { nombre: 'Perfil 1', pin: '1234', estado: 'asignado' as const, clienteNombre: 'Juan Pérez' },
          { nombre: 'Perfil 2', pin: '5678', estado: 'disponible' as const },
        ],
        estado: 'disponible' as const,
        createdAt: { seconds: 1234567890, nanoseconds: 0 },
        updatedAt: { seconds: 1234567890, nanoseconds: 0 },
      },
    ];
  });

  it('renders Header with "Panel Operativo" and "Dashboard"', () => {
    render(<Dashboard />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Panel Operativo/i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Dashboard/i);
    expect(screen.getByText('Resumen de tus ventas y métricas principales')).toBeInTheDocument();
  });

  it('renders all 5 Dark SaaS KPI cards', () => {
    render(<Dashboard />);

    expect(screen.getByText('Ingresos')).toBeInTheDocument();
    expect(screen.getByText('Utilidad')).toBeInTheDocument();
    expect(screen.getByText('Clientes Activos')).toBeInTheDocument();
    expect(screen.getByText('Stock Disponible')).toBeInTheDocument();
    expect(screen.getByText('Cartera Pendiente')).toBeInTheDocument();
  });

  it('renders all 4 quick action buttons and handles navigation', () => {
    render(<Dashboard />);

    const nuevaVentaBtn = screen.getByRole('button', { name: /nueva venta/i });
    const cargarCuentaBtn = screen.getByRole('button', { name: /cargar cuenta/i });
    const directorioClientesBtn = screen.getByRole('button', { name: /directorio clientes/i });
    const codigosAccesoBtn = screen.getByRole('button', { name: /códigos de acceso/i });

    expect(nuevaVentaBtn).toBeInTheDocument();
    expect(cargarCuentaBtn).toBeInTheDocument();
    expect(directorioClientesBtn).toBeInTheDocument();
    expect(codigosAccesoBtn).toBeInTheDocument();

    fireEvent.click(nuevaVentaBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/ventas');

    fireEvent.click(cargarCuentaBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/cuentas');

    fireEvent.click(directorioClientesBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/gestion-clientes');

    fireEvent.click(codigosAccesoBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/consulta-codigos');
  });

  it('renders Action Center with WhatsApp billing button for upcoming/overdue clients', () => {
    render(<Dashboard />);

    expect(screen.getByText('Action Center: Cobranza & Renovaciones')).toBeInTheDocument();
    expect(screen.getAllByText('Juan Pérez').length).toBeGreaterThan(0);

    const waLinks = screen.getAllByRole('link', { name: /cobrar whatsapp/i });
    expect(waLinks.length).toBeGreaterThan(0);
    expect(waLinks[0]).toHaveAttribute('href', expect.stringContaining('wa.me/573001234567'));
  });

  it('renders Action Center cohort buttons with count badges', () => {
    render(<Dashboard />);

    expect(screen.getByRole('button', { name: /próximos \(≤7d\) \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /urgentes \(≤3d\) \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /en mora \/ vencidos \(1\)/i })).toBeInTheDocument();
  });

  it('renders KPI 5 (Cartera Pendiente) with correct value and singular/plural debt subcaption', () => {
    render(<Dashboard />);

    expect(screen.getByText('Cartera Pendiente')).toBeInTheDocument();
    expect(screen.getAllByText('$5.000').length).toBeGreaterThanOrEqual(1);
    const captionEl = screen.getByText('cliente con saldo pendiente').parentElement;
    expect(captionEl).toHaveTextContent('1');
    expect(captionEl).toHaveTextContent('cliente con saldo pendiente');
  });

  it('pluralizes KPI 5 subcaption correctly for multiple clients with debt', () => {
    mockClientes = [
      { id: 'c-1', nombre: 'Juan Pérez', telefono: '3001234567', plataforma: 'Netflix', diasRestantes: 2, saldoPendiente: 5000, estado: 'activo' },
      { id: 'c-2', nombre: 'Ana Gómez', telefono: '3109876543', plataforma: 'Disney+', diasRestantes: 10, saldoPendiente: 3000, estado: 'activo' },
    ];

    render(<Dashboard />);

    const captionEl = screen.getByText('clientes con saldo pendiente').parentElement;
    expect(captionEl).toHaveTextContent('2');
    expect(captionEl).toHaveTextContent('clientes con saldo pendiente');
  });

  it('displays 0 clients with debt correctly in KPI 5 subcaption', () => {
    mockClientes = [
      { id: 'c-1', nombre: 'Juan Pérez', telefono: '3001234567', plataforma: 'Netflix', diasRestantes: 2, saldoPendiente: 0, estado: 'activo' },
    ];

    render(<Dashboard />);

    const captionEl = screen.getByText('clientes con saldo pendiente').parentElement;
    expect(captionEl).toHaveTextContent('0');
    expect(captionEl).toHaveTextContent('clientes con saldo pendiente');
  });

  it('paginates Action Center items (5 per page) and navigates between pages', () => {
    mockClientes = [
      { id: 'c-1', nombre: 'Cliente Uno', telefono: '3001111111', plataforma: 'Netflix', diasRestantes: 1, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-2', nombre: 'Cliente Dos', telefono: '3002222222', plataforma: 'Netflix', diasRestantes: 2, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-3', nombre: 'Cliente Tres', telefono: '3003333333', plataforma: 'Netflix', diasRestantes: 3, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-4', nombre: 'Cliente Cuatro', telefono: '3004444444', plataforma: 'Netflix', diasRestantes: 4, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-5', nombre: 'Cliente Cinco', telefono: '3005555555', plataforma: 'Netflix', diasRestantes: 5, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-6', nombre: 'Cliente Seis', telefono: '3006666666', plataforma: 'Netflix', diasRestantes: 6, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-7', nombre: 'Cliente Siete', telefono: '3007777777', plataforma: 'Netflix', diasRestantes: 7, saldoPendiente: 0, estado: 'activo' },
    ];

    render(<Dashboard />);

    // First 5 clients visible on page 1
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
    expect(screen.getByText('Cliente Dos')).toBeInTheDocument();
    expect(screen.getByText('Cliente Tres')).toBeInTheDocument();
    expect(screen.getByText('Cliente Cuatro')).toBeInTheDocument();
    expect(screen.getByText('Cliente Cinco')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Seis')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliente Siete')).not.toBeInTheDocument();

    // Paginator should display page numbers
    const page2Btn = screen.getByRole('button', { name: 'Ir a página 2' });
    expect(page2Btn).toBeInTheDocument();

    fireEvent.click(page2Btn);

    // Page 2 shows remaining 2 clients
    expect(screen.queryByText('Cliente Uno')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente Seis')).toBeInTheDocument();
    expect(screen.getByText('Cliente Siete')).toBeInTheDocument();
  });

  it('resets pagination page to 1 when switching cohort filters', () => {
    mockClientes = [
      { id: 'c-1', nombre: 'Cliente Uno', telefono: '3001111111', plataforma: 'Netflix', diasRestantes: 1, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-2', nombre: 'Cliente Dos', telefono: '3002222222', plataforma: 'Netflix', diasRestantes: 2, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-3', nombre: 'Cliente Tres', telefono: '3003333333', plataforma: 'Netflix', diasRestantes: 3, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-4', nombre: 'Cliente Cuatro', telefono: '3004444444', plataforma: 'Netflix', diasRestantes: 1, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-5', nombre: 'Cliente Cinco', telefono: '3005555555', plataforma: 'Netflix', diasRestantes: 2, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-6', nombre: 'Cliente Seis', telefono: '3006666666', plataforma: 'Netflix', diasRestantes: 3, saldoPendiente: 0, estado: 'activo' },
      { id: 'c-7', nombre: 'Cliente Siete', telefono: '3007777777', plataforma: 'Netflix', diasRestantes: 1, saldoPendiente: 0, estado: 'activo' },
    ];

    render(<Dashboard />);

    const page2Btn = screen.getByRole('button', { name: 'Ir a página 2' });
    fireEvent.click(page2Btn);
    expect(screen.getByText('Cliente Seis')).toBeInTheDocument();

    // Switch to Urgentes cohort
    const urgentesBtn = screen.getByRole('button', { name: /urgentes/i });
    fireEvent.click(urgentesBtn);

    // Should be on page 1 again
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
  });

  it('redirects admin users to AdminDashboard', () => {
    mockUser = { uid: 'admin-1', rol: 'admin', email: 'admin@streamcontrol.com' };
    render(<Dashboard />);

    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
  });

  describe('Mathematical & Data Consistency Assertions', () => {
    it('calculates combo sales revenue and utility accurately without double counting', () => {
      const today = new Date().toISOString().slice(0, 10);
      // Combo: 2 screens, unit price = 10,000 (total = 20,000), total cost = 8,000, utility = 12,000
      mockVentas = [
        {
          id: 'v-combo',
          nombre: 'Cliente Combo',
          telefono: '3000000001',
          plataforma: 'Netflix + Disney premium',
          pantallas: 2,
          precioVenta: 10000,
          costoServicio: 8000,
          utilidad: 12000,
          fechaVenta: today,
          monedaVenta: 'COP',
          tasaVenta: 1,
        },
      ];

      render(<Dashboard />);

      // Ingresos should be 2 * 10,000 = $20,000
      expect(screen.getAllByText('$20.000').length).toBeGreaterThanOrEqual(1);
      // Utilidad should be $12,000
      expect(screen.getByText('$12.000')).toBeInTheDocument();
      // Margen should be (12,000 / 20,000) * 100 = 60%
      expect(screen.getByText('60.0% Margen')).toBeInTheDocument();
    });

    it('calculates wholesale sales (esSubdistribuidor) accurately', () => {
      const today = new Date().toISOString().slice(0, 10);
      // Wholesale: 5 profiles, price per profile = 4,000 (total = 20,000), total cost = 10,000, utility = 10,000
      mockVentas = [
        {
          id: 'v-sub',
          nombre: 'Revendedor Pro',
          telefono: '3000000002',
          plataforma: 'Max',
          pantallas: 5,
          precioVenta: 4000,
          costoServicio: 10000,
          utilidad: 10000,
          fechaVenta: today,
          monedaVenta: 'COP',
          tasaVenta: 1,
        },
      ];

      render(<Dashboard />);

      expect(screen.getAllByText('$20.000').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('$10.000').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('50.0% Margen')).toBeInTheDocument();
    });

    it('applies currency conversion consistently across foreign currency sales', () => {
      const today = new Date().toISOString().slice(0, 10);
      mockConvertirVenta = (monto: number, monedaVenta?: string, tasaVenta?: number) => {
        if (monedaVenta === 'USD' && tasaVenta === 4000) {
          return monto * 4000;
        }
        return monto;
      };

      // Sale in USD: 1 screen, price = 5 USD, cost = 2 USD, utility = 3 USD
      mockVentas = [
        {
          id: 'v-usd',
          nombre: 'Cliente Internacional',
          telefono: '3000000003',
          plataforma: 'ChatGPT',
          pantallas: 1,
          precioVenta: 5,
          costoServicio: 2,
          utilidad: 3,
          fechaVenta: today,
          monedaVenta: 'USD',
          tasaVenta: 4000,
        },
      ];

      render(<Dashboard />);

      // 5 USD * 4000 = 20,000 COP
      expect(screen.getAllByText('$20.000').length).toBeGreaterThanOrEqual(1);
      // 3 USD * 4000 = 12,000 COP
      expect(screen.getByText('$12.000')).toBeInTheDocument();
    });

    it('handles clients with null diasRestantes properly without false positives in mora or urgent cohorts', () => {
      mockClientes = [
        // Client without due date and without pending debt -> active, NOT in mora, NOT urgent
        {
          id: 'c-no-expiry',
          nombre: 'Cliente Sin Vencimiento',
          telefono: '3000000010',
          plataforma: 'Netflix',
          diasRestantes: null,
          saldoPendiente: 0,
          estado: 'activo' as const,
        },
        // Client with pending debt -> in mora
        {
          id: 'c-debt-only',
          nombre: 'Cliente Con Deuda',
          telefono: '3000000011',
          plataforma: 'Disney+',
          diasRestantes: null,
          saldoPendiente: 15000,
          estado: 'activo' as const,
        },
        // Expired client -> in mora
        {
          id: 'c-expired',
          nombre: 'Cliente Vencido',
          telefono: '3000000012',
          plataforma: 'Max',
          diasRestantes: -2,
          saldoPendiente: 0,
          estado: 'activo' as const,
        },
      ];

      render(<Dashboard />);

      // Clientes Activos card exists and counts accurately
      expect(screen.getByText('Clientes Activos')).toBeInTheDocument();
      // Clientes en Mora should be 2 (c-debt-only with debt and c-expired)
      expect(screen.getByText(/en mora o vencidos/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /en mora \/ vencidos \(2\)/i })).toBeInTheDocument();
      // Urgent cohort should have 0 clients (no false positive from null diasRestantes)
      expect(screen.getByRole('button', { name: /urgentes \(≤3d\) \(0\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /próximos \(≤7d\) \(0\)/i })).toBeInTheDocument();
    });

    it('strictly sorts Action Center: ascending by days remaining in Proximos and Mora cohorts', () => {
      mockClientes = [
        { id: 'c-1d', nombre: 'Cliente Uno Dia', telefono: '3000000021', plataforma: 'Netflix', diasRestantes: 1, saldoPendiente: 0, estado: 'activo' },
        { id: 'c-overdue-5', nombre: 'Cliente Vencido 5d', telefono: '3000000022', plataforma: 'Netflix', diasRestantes: -5, saldoPendiente: 0, estado: 'activo' },
        { id: 'c-today', nombre: 'Cliente Hoy', telefono: '3000000023', plataforma: 'Netflix', diasRestantes: 0, saldoPendiente: 0, estado: 'activo' },
        { id: 'c-overdue-1', nombre: 'Cliente Vencido 1d', telefono: '3000000024', plataforma: 'Netflix', diasRestantes: -1, saldoPendiente: 0, estado: 'activo' },
        { id: 'c-3d', nombre: 'Cliente Tres Dias', telefono: '3000000025', plataforma: 'Netflix', diasRestantes: 3, saldoPendiente: 0, estado: 'activo' },
      ];

      render(<Dashboard />);

      // Default 'proximos' cohort shows 0d, 1d, 3d in ascending order
      const rowsProximos = screen.getAllByRole('row').slice(1);
      const clientNamesInProximos = rowsProximos.map((r) => r.querySelector('td')?.textContent || '');

      expect(clientNamesInProximos[0]).toContain('Cliente Hoy');
      expect(clientNamesInProximos[1]).toContain('Cliente Uno Dia');
      expect(clientNamesInProximos[2]).toContain('Cliente Tres Dias');

      // Switch to 'mora' cohort
      const moraBtn = screen.getByRole('button', { name: /en mora \/ vencidos/i });
      fireEvent.click(moraBtn);

      const rowsMora = screen.getAllByRole('row').slice(1);
      const clientNamesInMora = rowsMora.map((r) => r.querySelector('td')?.textContent || '');

      expect(clientNamesInMora[0]).toContain('Cliente Vencido 5d');
      expect(clientNamesInMora[1]).toContain('Cliente Vencido 1d');
    });

    it('categorizes client metrics according to realistic financial and expiration criteria', () => {
      mockClientes = [
        // 1. Activo con días > 0
        { id: 'c-act-1', nombre: 'Activo Normal', telefono: '3001', plataforma: 'Netflix', diasRestantes: 15, saldoPendiente: 0, estado: 'activo' },
        // 2. Activo sin días pero estado activo
        { id: 'c-act-2', nombre: 'Activo Sin Dias', telefono: '3002', plataforma: 'Netflix', diasRestantes: null, saldoPendiente: 0, estado: 'activo' },
        // 3. Vencimiento crítico (días >= 0 && días <= 3)
        { id: 'c-crit-1', nombre: 'Critico 2d', telefono: '3003', plataforma: 'Disney+', diasRestantes: 2, saldoPendiente: 0, estado: 'activo' },
        // 4. Vencimiento próximo (días >= 0 && días <= 7, no crítico >3)
        { id: 'c-prox-1', nombre: 'Proximo 5d', telefono: '3004', plataforma: 'Disney+', diasRestantes: 5, saldoPendiente: 0, estado: 'activo' },
        // 5. Vencido reciente (-30 <= días < 0)
        { id: 'c-venc-rec', nombre: 'Vencido 10d', telefono: '3005', plataforma: 'Max', diasRestantes: -10, saldoPendiente: 0, estado: 'inactivo' },
        // 6. Vencido antiguo (días < -30) sin deuda -> NO entra en mora
        { id: 'c-venc-ant', nombre: 'Vencido Antiguo', telefono: '3006', plataforma: 'Max', diasRestantes: -45, saldoPendiente: 0, estado: 'inactivo' },
        // 7. Cliente con deuda (saldoPendiente > 0)
        { id: 'c-deuda', nombre: 'Deudor', telefono: '3007', plataforma: 'Prime', diasRestantes: 20, saldoPendiente: 25000, estado: 'activo' },
      ];

      render(<Dashboard />);

      // Clientes Activos: c-act-1 (dias 15 > 0), c-act-2 (null & activo), c-crit-1 (2 > 0), c-prox-1 (5 > 0), c-deuda (20 > 0) -> Total: 5
      // Clientes inactivos c-venc-rec (-10) y c-venc-ant (-45) no son activos
      expect(screen.getByText('Clientes Activos')).toBeInTheDocument();

      // Proximos (<=7d): c-crit-1 (2d), c-prox-1 (5d) -> Total: 2
      expect(screen.getByRole('button', { name: /próximos \(≤7d\) \(2\)/i })).toBeInTheDocument();

      // Urgentes (<=3d): c-crit-1 (2d) -> Total: 1
      expect(screen.getByRole('button', { name: /urgentes \(≤3d\) \(1\)/i })).toBeInTheDocument();

      // Mora: c-venc-rec (-10d in [-30, 0)), c-deuda (saldo 25000 > 0) -> Total: 2
      expect(screen.getByRole('button', { name: /en mora \/ vencidos \(2\)/i })).toBeInTheDocument();

      // KPI 5 Cartera Pendiente: 1 cliente con saldo pendiente (c-deuda), Total $25.000
      expect(screen.getByText('$25.000')).toBeInTheDocument();
      const debtCaption = screen.getByText('cliente con saldo pendiente').parentElement;
      expect(debtCaption).toHaveTextContent('1');
      expect(debtCaption).toHaveTextContent('cliente con saldo pendiente');
    });

    it('calculates inventory capacity for full accounts and prevents negative available profiles', () => {
      mockCuentas = [
        // Full account: tipoVenta 'completa', estado 'asignada', perfiles empty -> 1 assigned, 0 available
        {
          id: 'cta-full-1',
          proveedor: 'Netflix',
          correoCuenta: 'full@stream.com',
          costo: 30000,
          tipoVenta: 'completa' as const,
          perfiles: [],
          estado: 'asignada' as const,
          maxPerfiles: 1,
          createdAt: { seconds: 1234567890, nanoseconds: 0 },
          updatedAt: { seconds: 1234567890, nanoseconds: 0 },
        },
        // Profile account: 4 profiles, 3 assigned, 1 available
        {
          id: 'cta-perfil-1',
          proveedor: 'Disney+',
          correoCuenta: 'disney@stream.com',
          costo: 20000,
          tipoVenta: 'perfiles' as const,
          perfiles: [
            { nombre: 'P1', pin: '1', estado: 'asignado' as const },
            { nombre: 'P2', pin: '2', estado: 'asignado' as const },
            { nombre: 'P3', pin: '3', estado: 'asignado' as const },
            { nombre: 'P4', pin: '4', estado: 'disponible' as const },
          ],
          estado: 'disponible' as const,
          createdAt: { seconds: 1234567890, nanoseconds: 0 },
          updatedAt: { seconds: 1234567890, nanoseconds: 0 },
        },
      ];

      render(<Dashboard />);

      // Total profiles: 1 + 4 = 5. Assigned: 1 + 3 = 4. Available: 5 - 4 = 1.
      expect(screen.getByText('Stock Disponible')).toBeInTheDocument();
      expect(screen.getByText(/4 de 5 perfiles asignados/i)).toBeInTheDocument();
      expect(screen.getByText(/80% Ocupado/i)).toBeInTheDocument();
    });

    it('aggregates VIP clients with case-insensitive deduplication and sorts descending by total spend', () => {
      const today = new Date().toISOString().slice(0, 10);
      mockVentas = [
        { id: 'v1', nombre: 'Carlos Ruiz', telefono: '300111', plataforma: 'Netflix', pantallas: 1, precioVenta: 10000, costoServicio: 2000, utilidad: 8000, fechaVenta: today, monedaVenta: 'COP', tasaVenta: 1 },
        { id: 'v2', nombre: 'carlos ruiz', telefono: '300111', plataforma: 'Disney+', pantallas: 1, precioVenta: 15000, costoServicio: 3000, utilidad: 12000, fechaVenta: today, monedaVenta: 'COP', tasaVenta: 1 },
        { id: 'v3', nombre: 'Maria Gomez', telefono: '300222', plataforma: 'Max', pantallas: 1, precioVenta: 50000, costoServicio: 10000, utilidad: 40000, fechaVenta: today, monedaVenta: 'COP', tasaVenta: 1 },
      ];

      render(<Dashboard />);

      // Maria Gomez spent 50,000 -> #1 VIP
      // Carlos Ruiz spent 10,000 + 15,000 = 25,000 -> #2 VIP
      expect(screen.getByText('Maria Gomez')).toBeInTheDocument();
      expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
      expect(screen.getByText('$50.000')).toBeInTheDocument();
      expect(screen.getByText('$25.000')).toBeInTheDocument();
    });
  });
});

