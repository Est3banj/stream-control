import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import toast from 'react-hot-toast';

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockLoginWithGoogle = vi.fn();
const mockCallFunction = vi.fn();

let mockUser: { uid: string; email: string; emailVerified?: boolean; rol?: string } | null = null;
let mockLoading = false;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    login: mockLogin,
    register: mockRegister,
    loginWithGoogle: mockLoginWithGoogle,
  }),
}));

vi.mock('../../lib/apiClient', () => ({
  callFunction: (...args: unknown[]) => mockCallFunction(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Login and Auth Container Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUser = null;
    mockLoading = false;
  });

  it('redirects already authenticated and verified user to / on mount', () => {
    mockUser = {
      uid: 'u-verified-1',
      email: 'already@streamcontrol.com',
      emailVerified: true,
      rol: 'usuario',
    };
    mockLoading = false;

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('renders login tab by default with inputs and actions', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('StreamControl Pro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('usuario@ejemplo.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar al panel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /¿Olvidaste tu contraseña\?/i })).toBeInTheDocument();
  });

  it('switches to Register form when clicking Crear cuenta tab', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const registerTab = screen.getByRole('button', { name: 'Crear cuenta' });
    fireEvent.click(registerTab);

    expect(screen.getByText('Creá tu cuenta gratis')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Juan Pérez')).toBeInTheDocument();
  });

  it('logs in successfully and navigates to dashboard', async () => {
    mockLogin.mockResolvedValueOnce({ user: { uid: 'u-100' } });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('usuario@ejemplo.com'), {
      target: { value: 'test@streamcontrol.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });

    const submitBtn = screen.getByRole('button', { name: /Entrar al panel/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@streamcontrol.com', 'password123');
      expect(toast.success).toHaveBeenCalledWith('¡Bienvenido!');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('redirects to /verificar-email when email is unverified', async () => {
    mockLogin.mockRejectedValueOnce(
      new Error('Verificá tu correo antes de continuar. Revisá tu bandeja de entrada.')
    );

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('usuario@ejemplo.com'), {
      target: { value: 'test@streamcontrol.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });

    const submitBtn = screen.getByRole('button', { name: /Entrar al panel/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/verificar-email');
    });
  });

  it('opens forgot password screen, sends recovery email, and shows confirmation', async () => {
    mockCallFunction.mockResolvedValueOnce({ success: true });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const forgotBtn = screen.getByRole('button', { name: /¿Olvidaste tu contraseña\?/i });
    fireEvent.click(forgotBtn);

    expect(await screen.findByText('¿Olvidaste tu contraseña?')).toBeInTheDocument();
    const emailInput = await screen.findByPlaceholderText('tu@correo.com');
    expect(emailInput).toBeInTheDocument();

    fireEvent.change(emailInput, {
      target: { value: 'recuperar@ejemplo.com' },
    });

    const sendBtn = screen.getByRole('button', { name: /Enviar enlace de recuperación/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledWith('enviarCorreoRecuperacion', {
        email: 'recuperar@ejemplo.com',
      });
      expect(screen.getByText('Correo de recuperación enviado')).toBeInTheDocument();
      expect(screen.getByText('recuperar@ejemplo.com')).toBeInTheDocument();
    });

    const backBtn = screen.getByRole('button', { name: /Volver al inicio de sesión/i });
    fireEvent.click(backBtn);

    expect(screen.getByPlaceholderText('usuario@ejemplo.com')).toBeInTheDocument();
  });

  it('handles 429 rate limit error gracefully when requesting recovery email', async () => {
    mockCallFunction.mockRejectedValueOnce({
      code: 'functions/resource-exhausted',
      message: 'Resource exhausted',
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const forgotBtn = screen.getByRole('button', { name: /¿Olvidaste tu contraseña\?/i });
    fireEvent.click(forgotBtn);

    const emailInput = await screen.findByPlaceholderText('tu@correo.com');
    fireEvent.change(emailInput, {
      target: { value: 'rate-limited@ejemplo.com' },
    });

    const sendBtn = screen.getByRole('button', { name: /Enviar enlace de recuperación/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledWith('enviarCorreoRecuperacion', {
        email: 'rate-limited@ejemplo.com',
      });
      expect(toast.error).toHaveBeenCalledWith(
        'Ya te enviamos un enlace de recuperación recientemente. Por favor, esperá un minuto antes de solicitar otro.'
      );
    });

    // Cooldown should be active and button disabled with cooldown text
    expect(sendBtn).toBeDisabled();
    expect(screen.getByText(/Reintentar en \d+s/)).toBeInTheDocument();
  });

  it('disables submit button and shows loading state while recovery is in flight', async () => {
    let resolveCall: (value: unknown) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveCall = resolve;
    });
    mockCallFunction.mockReturnValueOnce(pendingPromise);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const forgotBtn = screen.getByRole('button', { name: /¿Olvidaste tu contraseña\?/i });
    fireEvent.click(forgotBtn);

    const emailInput = await screen.findByPlaceholderText('tu@correo.com');
    fireEvent.change(emailInput, {
      target: { value: 'slow@ejemplo.com' },
    });

    const sendBtn = screen.getByRole('button', { name: /Enviar enlace de recuperación/i });
    fireEvent.click(sendBtn);

    // Button should be disabled and showing loading text
    expect(sendBtn).toBeDisabled();
    expect(screen.getByText('Enviando instrucciones...')).toBeInTheDocument();

    resolveCall({ success: true });
    await waitFor(() => {
      expect(screen.getByText('Correo de recuperación enviado')).toBeInTheDocument();
    });
  });
});
