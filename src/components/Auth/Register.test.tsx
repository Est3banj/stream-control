import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import toast from 'react-hot-toast';

const mockNavigate = vi.fn();
const mockRegister = vi.fn();
const mockLoginWithGoogle = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    register: mockRegister,
    loginWithGoogle: mockLoginWithGoogle,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form with all required inputs and options', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    expect(screen.getByText('Creá tu cuenta gratis')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('juan@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mínimo 6 caracteres')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear cuenta gratis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar con Google/i })).toBeInTheDocument();
  });

  it('shows error toast when attempting to submit with empty inputs', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const submitBtn = screen.getByRole('button', { name: /Crear cuenta gratis/i });
    fireEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalledWith('Por favor completá todos los campos obligatorios');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows error toast when password is less than 6 characters', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Juan Pérez'), { target: { value: 'Carlos Ruiz' } });
    fireEvent.change(screen.getByPlaceholderText('juan@ejemplo.com'), { target: { value: 'carlos@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 6 caracteres'), { target: { value: '12345' } });

    const submitBtn = screen.getByRole('button', { name: /Crear cuenta gratis/i });
    fireEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalledWith('La contraseña debe tener al menos 6 caracteres');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('submits form successfully and redirects to /verificar-email', async () => {
    mockRegister.mockResolvedValueOnce({ user: { uid: 'u-123' } });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Juan Pérez'), { target: { value: 'Carlos Ruiz' } });
    fireEvent.change(screen.getByPlaceholderText('juan@ejemplo.com'), { target: { value: 'carlos@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 6 caracteres'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'COP' } });

    const submitBtn = screen.getByRole('button', { name: /Crear cuenta gratis/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        nombre: 'Carlos Ruiz',
        correo: 'carlos@ejemplo.com',
        password: 'password123',
        moneda: 'COP',
        tasa: 1,
      });
      expect(toast.success).toHaveBeenCalledWith('¡Cuenta creada con éxito! Revisá tu correo.');
      expect(mockNavigate).toHaveBeenCalledWith('/verificar-email');
    });
  });

  it('handles auth/email-already-in-use error', async () => {
    mockRegister.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Juan Pérez'), { target: { value: 'Carlos Ruiz' } });
    fireEvent.change(screen.getByPlaceholderText('juan@ejemplo.com'), { target: { value: 'existente@ejemplo.com' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 6 caracteres'), { target: { value: 'password123' } });

    const submitBtn = screen.getByRole('button', { name: /Crear cuenta gratis/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Este correo ya está registrado. Iniciá sesión con tu contraseña.');
    });
  });

  it('toggles password visibility when clicking eye button', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText('Mínimo 6 caracteres');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /Ver contraseña/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');

    const hideBtn = screen.getByRole('button', { name: /Ocultar contraseña/i });
    fireEvent.click(hideBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('handles Google sign in', async () => {
    mockLoginWithGoogle.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const googleBtn = screen.getByRole('button', { name: /Continuar con Google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(mockLoginWithGoogle).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('¡Bienvenido!');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
