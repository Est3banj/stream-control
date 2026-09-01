import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GestionCuentas from './GestionCuentas';
import { Timestamp } from 'firebase/firestore';

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

vi.mock('../hooks/useCuentas', () => ({
  default: () => ({
    cuentas: [
      {
        id: 'cuenta-1',
        proveedor: 'Netflix',
        correoCuenta: 'netflix@test.com',
        costo: 30000,
        tipoVenta: 'perfiles',
        estado: 'disponible',
        imapConfigurado: false,
        perfiles: [
          { nombre: 'Perfil 1', pin: '1111', estado: 'disponible' },
          { nombre: 'Perfil 2', pin: '2222', estado: 'disponible' },
        ],
        createdAt: Timestamp.fromMillis(1000),
        updatedAt: Timestamp.fromMillis(1000),
      },
    ],
    loading: false,
    error: null,
  }),
  crearCuenta: vi.fn(),
  actualizarCuenta: vi.fn(),
  asignarPerfil: vi.fn(),
}));

vi.mock('../hooks/useClientes', () => ({
  default: () => ({
    clientes: [
      { id: 'cli-1', nombre: 'Juan Pérez', telefono: '+573001234567' },
    ],
    loading: false,
  }),
}));

vi.mock('../hooks/useMoneda', () => ({
  useMoneda: () => ({
    formatear: (v: number) => `$${v}`,
  }),
}));

vi.mock('../lib/apiClient', () => ({
  callFunction: vi.fn().mockResolvedValue({
    proveedor: 'Netflix',
    correoCuenta: 'netflix@test.com',
    correo: 'netflix@test.com',
    contrasena: 'secret123',
    perfiles: [],
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

describe('GestionCuentas — Sub-feature Gating & IMAP Lock', () => {
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

  it('Starter plan: clicking "Configurar IMAP" blocks modal and opens UpgradeModal', () => {
    render(<GestionCuentas />);

    expect(screen.getByText('Gestión de Cuentas')).toBeTruthy();
    expect(screen.getByText(/Plan Starter/i)).toBeTruthy();

    // Click on DropdownMenu trigger
    const dropdownTrigger = screen.getByTitle('Acciones');
    fireEvent.click(dropdownTrigger);

    // Click on "Configurar IMAP" action
    const imapAction = screen.getByText('Configurar IMAP');
    expect(imapAction).toBeTruthy();
    fireEvent.click(imapAction);

    // Verify upgrade modal was triggered and toast error was shown
    expect(mockShowUpgradeModal).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('La configuración IMAP y extracción automática de códigos es exclusiva del plan Enterprise')
    );

    // Verify IMAP modal is NOT opened
    expect(screen.queryByText('Credenciales IMAP')).toBeNull();
  });

  it('Professional plan: clicking "Configurar IMAP" also blocks modal and triggers UpgradeModal', () => {
    mockPermisos = {
      ...mockPermisos,
      planNombre: 'Professional',
      clienteLimit: Infinity,
      cuentaLimit: Infinity,
      puedeUsarTelegram: true,
      puedeVerReportesAvanzados: true,
      puedeGenerarTokens: false,
    };

    render(<GestionCuentas />);

    // Open dropdown
    const dropdownTrigger = screen.getByTitle('Acciones');
    fireEvent.click(dropdownTrigger);

    // Click on Configurar IMAP
    const imapAction = screen.getByText('Configurar IMAP');
    fireEvent.click(imapAction);

    expect(mockShowUpgradeModal).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('La configuración IMAP y extracción automática de códigos es exclusiva del plan Enterprise')
    );
    expect(screen.queryByText('Credenciales IMAP')).toBeNull();
  });

  it('Enterprise plan: clicking "Configurar IMAP" opens IMAP configuration modal', () => {
    mockPermisos = {
      ...mockPermisos,
      planNombre: 'Enterprise',
      clienteLimit: Infinity,
      cuentaLimit: Infinity,
      puedeUsarTelegram: true,
      puedeVerReportesAvanzados: true,
      puedeGenerarTokens: true,
    };

    render(<GestionCuentas />);

    // Open dropdown
    const dropdownTrigger = screen.getByTitle('Acciones');
    fireEvent.click(dropdownTrigger);

    // Click on Configurar IMAP
    const imapAction = screen.getByText('Configurar IMAP');
    fireEvent.click(imapAction);

    // UpgradeModal should NOT have been called
    expect(mockShowUpgradeModal).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();

    // IMAP modal SHOULD be rendered
    expect(screen.getByText('Credenciales IMAP')).toBeTruthy();
  });

  it('Starter quota limit triggers upgrade modal when adding beyond quota', async () => {
    mockPermisos = {
      ...mockPermisos,
      cuentaLimit: 1, // Already have 1 account in list
    };

    render(<GestionCuentas />);

    const registrarBtn = screen.getByRole('button', { name: /\+ Registrar Cuenta/i });
    fireEvent.click(registrarBtn);

    expect(mockShowUpgradeModal).toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('Alcanzaste el límite de 1 cuentas streaming del plan Starter')
    );
  });
});
