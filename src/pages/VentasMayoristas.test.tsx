import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VentasMayoristas from './VentasMayoristas';
import { Timestamp } from 'firebase/firestore';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', email: 'test@streamcontrol.com', rol: 'usuario' },
  }),
}));

vi.mock('../hooks/usePermisos', () => ({
  default: () => ({
    puedeGenerarTokens: true,
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
        perfiles: [
          { nombre: 'Perfil 1', pin: '1111', estado: 'disponible' },
          { nombre: 'Perfil 2', pin: '2222', estado: 'disponible' },
        ],
        createdAt: Timestamp.fromMillis(1000),
        updatedAt: Timestamp.fromMillis(1000),
      },
    ],
    loading: false,
  }),
}));

vi.mock('../hooks/useTokens', () => ({
  default: () => ({
    tokens: [
      {
        id: 'token-abc-12345678',
        cuentaId: 'cuenta-1',
        clienteNombre: 'Revendedor Uno',
        activo: true,
        expiraEn: new Date(Date.now() + 86400000 * 10).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
    loading: false,
  }),
  revocarToken: vi.fn(),
  reactivarToken: vi.fn(),
}));

vi.mock('../lib/apiClient', () => ({
  callFunction: vi.fn().mockResolvedValue({ url: '/r/token-xyz' }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('VentasMayoristas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, metrics and tabs', () => {
    render(<VentasMayoristas />);

    expect(screen.getByRole('heading', { level: 1, name: /Ventas Mayoristas/i })).toBeTruthy();
    expect(screen.getByText('Total Links')).toBeTruthy();
    expect(screen.getByText('Activos')).toBeTruthy();
    expect(screen.getByText('Vencidos / Revocados')).toBeTruthy();
    expect(screen.getByText('Nueva Venta Mayorista')).toBeTruthy();
    expect(screen.getByText(/Ventas Mayoristas Activas/i)).toBeTruthy();
  });

  it('can switch between tabs', () => {
    render(<VentasMayoristas />);

    // Click on active links tab
    const activasTabBtn = screen.getByText(/Ventas Mayoristas Activas/i);
    fireEvent.click(activasTabBtn);

    expect(screen.getByText('Revendedor Uno')).toBeTruthy();
    expect(screen.getByText('Netflix')).toBeTruthy();
    expect(screen.getByText('Activo')).toBeTruthy();
  });

  it('shows account perfiles when account is selected in new sale tab', () => {
    render(<VentasMayoristas />);

    const selectCuenta = screen.getByRole('combobox');
    fireEvent.change(selectCuenta, { target: { value: 'cuenta-1' } });

    expect(screen.getByText('Perfil 1')).toBeTruthy();
    expect(screen.getByText('Perfil 2')).toBeTruthy();
    expect(screen.getByText('Nombre del revendedor / sub-distribuidor')).toBeTruthy();
  });

  it('header button switches from activas to nueva tab', () => {
    render(<VentasMayoristas />);

    // Switch to activas tab
    fireEvent.click(screen.getByText(/Ventas Mayoristas Activas/i));
    expect(screen.getByText('Revendedor Uno')).toBeTruthy();

    // Click header button "Registrar Venta Mayorista"
    const headerBtn = screen.getByRole('button', { name: /Registrar Venta Mayorista/i });
    fireEvent.click(headerBtn);

    // Should switch back to nueva tab
    expect(screen.getByText(/Seleccionar cuenta/i)).toBeTruthy();
  });

  it('header button triggers submission when form is filled', async () => {
    const { callFunction } = await import('../lib/apiClient');
    render(<VentasMayoristas />);

    // Select account
    const selectCuenta = screen.getByRole('combobox');
    fireEvent.change(selectCuenta, { target: { value: 'cuenta-1' } });

    // Select profile
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);

    // Enter revendedor name
    const nombreInput = screen.getByPlaceholderText(/Ej: Distribuidor Express/i);
    fireEvent.change(nombreInput, { target: { value: 'Revendedor Pro' } });

    // Click header button to submit
    const headerBtn = screen.getAllByRole('button', { name: /Registrar Venta Mayorista/i })[0];
    fireEvent.click(headerBtn);

    expect(callFunction).toHaveBeenCalledWith('generarTokenSubdistribuidor', expect.objectContaining({
      cuentaId: 'cuenta-1',
      clienteNombre: 'Revendedor Pro',
      cantidad: 1,
    }));
  });
});
