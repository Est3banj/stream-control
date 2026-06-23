import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CuentaForm from './CuentaForm';

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('CuentaForm', () => {
  const mockSubmit = vi.fn();
  const mockCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields', () => {
    render(<CuentaForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    expect(screen.getByText('Proveedor')).toBeTruthy();
    expect(screen.getByText('Correo de la cuenta')).toBeTruthy();
    expect(screen.getByText('Contraseña')).toBeTruthy();
    expect(screen.getByText('Costo de la cuenta')).toBeTruthy();
    expect(screen.getByText('Perfiles')).toBeTruthy();
  });

  it('validates required fields before submit', () => {
    render(<CuentaForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    const guardarBtn = screen.getByText('Guardar Cuenta');
    fireEvent.click(guardarBtn);

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('can add perfiles dynamically', () => {
    render(<CuentaForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    const agregarBtn = screen.getByText('Agregar perfil');
    fireEvent.click(agregarBtn);

    const perfilInputs = screen.getAllByPlaceholderText('Nombre del perfil');
    expect(perfilInputs).toHaveLength(2);
  });

  it('can remove perfiles', async () => {
    render(<CuentaForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    const agregarBtn = screen.getByText('Agregar perfil');
    fireEvent.click(agregarBtn);

    let perfilInputs = screen.getAllByPlaceholderText('Nombre del perfil');
    expect(perfilInputs).toHaveLength(2);

    const removeBtn = document.querySelector('button.p-2.rounded-lg.text-red-500');
    if (removeBtn) fireEvent.click(removeBtn);

    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText('Nombre del perfil');
      expect(inputs).toHaveLength(1);
    });
  });

  it('renders with initial data in edit mode', () => {
    const initialData = {
      id: 'test-id',
      proveedor: 'Netflix',
      correoCuenta: 'netflix@test.com',
      costo: 30000,
      tipoVenta: 'perfiles' as const,
      perfiles: [
        { nombre: 'Perfil 1', pin: '1234', estado: 'disponible' as const },
      ],
      estado: 'disponible' as const,
      propietarioId: 'user-id',
      createdAt: { seconds: 1000, nanoseconds: 0 },
      updatedAt: { seconds: 1000, nanoseconds: 0 },
    };

    render(<CuentaForm onSubmit={mockSubmit} onCancel={mockCancel} initialData={initialData} />);

    expect(screen.getByText('Guardar Cambios')).toBeTruthy();
    expect(screen.getByDisplayValue('Netflix')).toBeTruthy();
    expect(screen.getByDisplayValue('30000')).toBeTruthy();
  });

  it('disables submit button while loading', () => {
    render(<CuentaForm onSubmit={mockSubmit} onCancel={mockCancel} loading={true} />);

    const guardarBtn = screen.getByText('Guardando...');
    expect(guardarBtn).toBeTruthy();
    expect((guardarBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
