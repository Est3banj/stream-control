import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminDashboard from './AdminDashboard';

// Mock Recharts components for jsdom compatibility
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
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

const mockUseAdminMetrics = vi.fn();
const mockUseBroadcastBanner = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'admin-1', rol: 'admin', email: 'admin@streamcontrol.com' } }),
}));

vi.mock('../hooks/useAdminMetrics', () => ({
  useAdminMetrics: () => mockUseAdminMetrics(),
}));

vi.mock('../hooks/useBroadcastBanner', () => ({
  useBroadcastBanner: () => mockUseBroadcastBanner(),
}));

vi.mock('../hooks/useSuscripciones', () => ({
  actualizarSuscripcion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseBroadcastBanner.mockReturnValue({
      broadcast: { activo: false, mensaje: '', tipo: 'info' },
      loading: false,
      updateBroadcast: vi.fn().mockResolvedValue(undefined),
      clearBroadcast: vi.fn().mockResolvedValue(undefined),
    });

    mockUseAdminMetrics.mockReturnValue({
      mrr: 150000,
      arr: 1800000,
      arpu: 30000,
      totalUsuarios: 25,
      totalTenants: 24,
      usuariosVerificados: 20,
      usuariosPendientes: 5,
      porcentajeVerificados: 80,
      activeTenantsCount: 5,
      suscripcionesActivasCount: 5,
      tasaConversion: 20.8,
      carteraPendiente: 60000,
      totalPendientesCount: 2,
      totalRecaudadoHistorico: 500000,
      proximosVencer3Dias: [],
      proximosVencer7Dias: [],
      vencidasSinRenovar: [],
      todasExpiraciones: [
        {
          suscripcion: {
            id: 'sub-1',
            usuarioId: 'u-1',
            usuarioNombre: 'Carlos Santana',
            planNombre: 'Pro Mensual',
            monto: 30000,
            pagoEstado: 'pendiente',
            estado: 'activa',
            fechaFin: { seconds: Math.floor(Date.now() / 1000) + 86400 * 2, nanoseconds: 0 },
          },
          usuario: { id: 'u-1', nombre: 'Carlos Santana', correo: 'carlos@santana.com' },
          diasRestantes: 2,
          esMora: false,
        },
      ],
      distribucionPlanes: [{ name: 'Pro Mensual', value: 5 }],
      timelineCrecimiento: [{ mes: 'Ago 26', usuarios: 25, ingresos: 150000 }],
      loading: false,
      error: null,
    });
  });

  it('renders Executive SaaS Dashboard header and 4 KPI Cards', () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Panel Ejecutivo SaaS')).toBeInTheDocument();
    expect(screen.getByText('MRR Recurrente Mensual')).toBeInTheDocument();
    expect(screen.getByText('Suscriptores Activos')).toBeInTheDocument();
    expect(screen.getByText('Directorio de Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Cartera por Cobrar')).toBeInTheDocument();
  });

  it('renders Action Center with WhatsApp billing button', () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Action Center: Cobranza & Vencimientos')).toBeInTheDocument();
    expect(screen.getByText('Carlos Santana')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cobrar whatsapp/i })).toBeInTheDocument();
  });

  it('opens Broadcast Banner Manager modal when clicking Alerta Global button', async () => {
    render(<AdminDashboard />);

    const broadcastBtn = screen.getByRole('button', { name: /alerta global/i });
    fireEvent.click(broadcastBtn);

    await waitFor(() => {
      expect(screen.getByText('Anuncio Global')).toBeInTheDocument();
      expect(screen.getByText('Publicar banner visible para todos los tenants')).toBeInTheDocument();
    });
  });
});
