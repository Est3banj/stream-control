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

const mockVentas = [
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

const mockClientes = [
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

const mockCuentas = [
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
    formatear: (v: number) => `$${v.toLocaleString('es-CO')}`,
    convertirVenta: (monto: number) => monto,
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

  it('redirects admin users to AdminDashboard', () => {
    mockUser = { uid: 'admin-1', rol: 'admin', email: 'admin@streamcontrol.com' };
    render(<Dashboard />);

    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
  });
});

