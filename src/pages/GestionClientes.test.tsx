import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GestionClientes from './GestionClientes';
import { MemoryRouter } from 'react-router-dom';

const mockShowUpgradeModal = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

let mockPermisos = {
  planNombre: 'Starter',
  loading: false,
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

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', email: 'test@streamcontrol.com', rol: 'usuario' },
  }),
}));

vi.mock('../hooks/usePermisos', () => ({
  default: () => mockPermisos,
}));

vi.mock('../contexts/UpgradeModalContext', () => ({
  useUpgradeModal: () => ({
    show: mockShowUpgradeModal,
  }),
}));

let mockClientes = [
  {
    id: 'cli-1',
    nombre: 'Carlos Ruiz',
    telefono: '+573009998877',
    correo: 'carlos@test.com',
    plataforma: 'Netflix',
    cuentaId: 'cuenta-1',
    perfilAsignado: 'Perfil 1',
    fechaVencimiento: new Date(Date.now() + 86400000 * 15).toISOString().split('T')[0],
    diasRestantes: 15,
    saldoPendiente: 0,
    esMayorista: false,
    pantallas: 1,
  },
  {
    id: 'cli-2',
    nombre: 'Mayorista Tech',
    telefono: '+573001234567',
    correo: 'mayorista@test.com',
    plataforma: 'Netflix',
    cuentaId: 'cuenta-1',
    fechaVencimiento: new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0],
    diasRestantes: 20,
    saldoPendiente: 0,
    esMayorista: true,
    pantallas: 4,
  },
];

vi.mock('../hooks/useClientes', () => ({
  default: () => ({
    clientes: mockClientes,
    loading: false,
    error: null,
  }),
  crearCliente: vi.fn(),
  actualizarCliente: vi.fn(),
  eliminarCliente: vi.fn(),
  liberarPerfilCliente: vi.fn(),
}));

vi.mock('../hooks/useCuentas', () => ({
  default: () => ({
    cuentas: [
      {
        id: 'cuenta-1',
        proveedor: 'Netflix',
        correoCuenta: 'netflix@test.com',
      },
    ],
    loading: false,
  }),
}));

vi.mock('../hooks/useTokens', () => ({
  default: () => ({
    tokens: [],
    loading: false,
  }),
  generarToken: vi.fn(),
  revocarToken: vi.fn(),
}));

vi.mock('../hooks/useMoneda', () => ({
  useMoneda: () => ({
    formatear: (v: number) => `$${v}`,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

describe('GestionClientes — Enterprise Sub-feature Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermisos = {
      planNombre: 'Starter',
      loading: false,
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
  });

  it('Starter plan: code actions (Consultar código / Generar link) are hidden from dropdown', () => {
    render(
      <MemoryRouter>
        <GestionClientes />
      </MemoryRouter>
    );

    const dropdownTrigger = screen.getAllByTitle('Acciones')[0];
    fireEvent.click(dropdownTrigger);

    expect(screen.queryByText('Consultar código')).toBeNull();
    expect(screen.queryByText('Generar link')).toBeNull();
    expect(screen.getByText('Renovar')).toBeTruthy();
    expect(screen.getByText('Generar ticket')).toBeTruthy();
  });

  it('Enterprise plan: code actions (Consultar código / Generar link) are available', () => {
    mockPermisos = {
      ...mockPermisos,
      planNombre: 'Enterprise',
      clienteLimit: Infinity,
      cuentaLimit: Infinity,
      puedeGenerarTokens: true,
    };

    render(
      <MemoryRouter>
        <GestionClientes />
      </MemoryRouter>
    );

    const dropdownTrigger = screen.getAllByTitle('Acciones')[0];
    fireEvent.click(dropdownTrigger);

    expect(screen.getByText('Consultar código')).toBeTruthy();
    expect(screen.getByText('Generar link')).toBeTruthy();
  });

  it('renders Mayorista badge for wholesale clients', () => {
    render(
      <MemoryRouter>
        <GestionClientes />
      </MemoryRouter>
    );

    expect(screen.getByText('Mayorista (4 pantallas)')).toBeTruthy();
    expect(screen.getByText('Mayorista Tech')).toBeTruthy();
  });
});
