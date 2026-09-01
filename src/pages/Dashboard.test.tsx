import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from './Dashboard';

// Mock Recharts components for jsdom compatibility
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
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

const mockUser = { uid: 'user-starter-1', rol: 'usuario', email: 'starter@streamcontrol.com' };

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

vi.mock('../hooks/useVentas', () => ({
  default: () => ({
    ventas: [
      {
        id: 'v-1',
        nombre: 'Juan Pérez',
        plataforma: 'Netflix',
        pantallas: 1,
        precioVenta: 15000,
        costoServicio: 5000,
        utilidad: 10000,
        fechaVenta: '2026-09-01',
        monedaVenta: 'COP',
        tasaVenta: 1,
      },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useClientes', () => ({
  default: () => ({
    clientes: [{ id: 'c-1', nombre: 'Juan Pérez', telefono: '+573001234567' }],
    loading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useSuscripciones', () => ({
  default: () => ({
    suscripciones: [],
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

describe('Dashboard — Retail Experience for Starter Tenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sales metrics and charts for Starter user without FeatureBlocked', () => {
    render(<Dashboard />);

    // Header is rendered
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Resumen de tus ventas y métricas principales')).toBeInTheDocument();

    // Metric cards rendered
    expect(screen.getByText('Ingresos')).toBeInTheDocument();
    expect(screen.getByText('Egresos')).toBeInTheDocument();
    expect(screen.getByText('Utilidad')).toBeInTheDocument();

    // FeatureBlocked is NOT rendered
    expect(screen.queryByText(/función bloqueada/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/plan enterprise/i)).not.toBeInTheDocument();
  });
});
