import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import toast from 'react-hot-toast';

const mockNavigate = vi.fn();
const mockVerifyPasswordResetCode = vi.fn();
const mockConfirmPasswordReset = vi.fn();
const mockCallFunction = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode: (...args: unknown[]) => mockVerifyPasswordResetCode(...args),
  confirmPasswordReset: (...args: unknown[]) => mockConfirmPasswordReset(...args),
}));

vi.mock('../firebase', () => ({
  auth: { currentUser: null },
}));

vi.mock('../lib/apiClient', () => ({
  callFunction: (...args: unknown[]) => mockCallFunction(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ResetPassword Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/reset-password');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/reset-password');
  });

  it('renders invalid code screen when oobCode query param is missing', () => {
    window.history.replaceState(null, '', '/reset-password');

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    expect(screen.getByText('Enlace inválido o expirado')).toBeInTheDocument();
    expect(
      screen.getByText('No se encontró el código de recuperación en el enlace.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solicitar nuevo enlace/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver al inicio de sesión/i })).toBeInTheDocument();
  });

  it('displays validating loader while verifying oobCode on mount', () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=pending-code');
    mockVerifyPasswordResetCode.mockReturnValue(new Promise(() => {})); // pending promise

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    expect(screen.getByText('Verificando enlace...')).toBeInTheDocument();
    expect(screen.getByText(/Estamos comprobando la validez de tu enlace/i)).toBeInTheDocument();
  });

  it('renders error card when oobCode has expired', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=expired-code');
    const error = new Error('Expired');
    (error as unknown as { code: string }).code = 'auth/expired-action-code';
    mockVerifyPasswordResetCode.mockRejectedValueOnce(error);

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Enlace inválido o expirado')).toBeInTheDocument();
      expect(
        screen.getByText('El enlace de recuperación ha expirado. Por favor, solicitá uno nuevo.')
      ).toBeInTheDocument();
    });
  });

  it('renders error card when oobCode is invalid or already used', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=used-code');
    const error = new Error('Invalid');
    (error as unknown as { code: string }).code = 'auth/invalid-action-code';
    mockVerifyPasswordResetCode.mockRejectedValueOnce(error);

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Enlace inválido o expirado')).toBeInTheDocument();
      expect(
        screen.getByText('El enlace de recuperación no es válido o ya fue utilizado.')
      ).toBeInTheDocument();
    });
  });

  it('renders reset password form when oobCode is valid and displays user email', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=valid-code');
    mockVerifyPasswordResetCode.mockResolvedValueOnce('esteban@example.com');

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Restablecer contraseña' })).toBeInTheDocument();
      expect(screen.getByText('esteban@example.com')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Mínimo 6 caracteres')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Repetí la nueva contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar nueva contraseña/i })).toBeInTheDocument();
  });

  it('toggles password and confirmPassword visibility on eye button click', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=valid-code');
    mockVerifyPasswordResetCode.mockResolvedValueOnce('esteban@example.com');

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    const passwordInput = await screen.findByPlaceholderText('Mínimo 6 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repetí la nueva contraseña');

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');

    const togglePasswordBtn = screen.getByLabelText('Ver contraseña');
    fireEvent.click(togglePasswordBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');

    const toggleConfirmBtn = screen.getByLabelText('Ver confirmación de contraseña');
    fireEvent.click(toggleConfirmBtn);
    expect(confirmInput).toHaveAttribute('type', 'text');
  });

  it('shows password requirements checklist and password match indicator', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=valid-code');
    mockVerifyPasswordResetCode.mockResolvedValueOnce('esteban@example.com');

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    const passwordInput = await screen.findByPlaceholderText('Mínimo 6 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repetí la nueva contraseña');

    fireEvent.change(passwordInput, { target: { value: 'pass123' } });

    expect(screen.getByText('6+ caracteres')).toBeInTheDocument();
    expect(screen.getByText('Letras')).toBeInTheDocument();
    expect(screen.getByText('Números')).toBeInTheDocument();

    fireEvent.change(confirmInput, { target: { value: 'mismatch' } });
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();

    fireEvent.change(confirmInput, { target: { value: 'pass123' } });
    expect(screen.getByText('Las contraseñas coinciden')).toBeInTheDocument();
  });

  it('validates password length on submit', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=valid-code');
    mockVerifyPasswordResetCode.mockResolvedValueOnce('esteban@example.com');

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    const passwordInput = await screen.findByPlaceholderText('Mínimo 6 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repetí la nueva contraseña');

    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.change(confirmInput, { target: { value: '123' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar nueva contraseña/i });
    fireEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalledWith('La contraseña debe tener al menos 6 caracteres');
    expect(mockConfirmPasswordReset).not.toHaveBeenCalled();
  });

  it('validates matching passwords on submit', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=valid-code');
    mockVerifyPasswordResetCode.mockResolvedValueOnce('esteban@example.com');

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    const passwordInput = await screen.findByPlaceholderText('Mínimo 6 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repetí la nueva contraseña');

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'different123' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar nueva contraseña/i });
    fireEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalledWith('Las contraseñas no coinciden');
    expect(mockConfirmPasswordReset).not.toHaveBeenCalled();
  });

  it('submits successfully, calls confirmPasswordReset, dispatches notification, and shows success card', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/reset-password?oobCode=valid-code');
    mockVerifyPasswordResetCode.mockResolvedValueOnce('esteban@example.com');
    mockConfirmPasswordReset.mockResolvedValueOnce(undefined);
    mockCallFunction.mockResolvedValueOnce({ success: true });

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    // Wait for verifyPasswordResetCode resolution
    await vi.waitFor(() => {
      expect(screen.getByPlaceholderText('Mínimo 6 caracteres')).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('Mínimo 6 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repetí la nueva contraseña');

    fireEvent.change(passwordInput, { target: { value: 'securePass123' } });
    fireEvent.change(confirmInput, { target: { value: 'securePass123' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar nueva contraseña/i });
    fireEvent.click(submitBtn);

    await vi.waitFor(() => {
      expect(mockConfirmPasswordReset).toHaveBeenCalledWith(
        expect.anything(),
        'valid-code',
        'securePass123'
      );
      expect(mockCallFunction).toHaveBeenCalledWith('notificarPasswordReseteado', {
        email: 'esteban@example.com',
      });
      expect(toast.success).toHaveBeenCalledWith('¡Contraseña restablecida con éxito!');
      expect(screen.getByText('¡Contraseña restablecida!')).toBeInTheDocument();
    });

    vi.advanceTimersByTime(2500);
    expect(mockNavigate).toHaveBeenCalledWith('/login');

    vi.useRealTimers();
  });

  it('handles confirmPasswordReset failure with expired code error', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=valid-code');
    mockVerifyPasswordResetCode.mockResolvedValueOnce('esteban@example.com');
    const error = new Error('Expired');
    (error as unknown as { code: string }).code = 'auth/expired-action-code';
    mockConfirmPasswordReset.mockRejectedValueOnce(error);

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    const passwordInput = await screen.findByPlaceholderText('Mínimo 6 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repetí la nueva contraseña');

    fireEvent.change(passwordInput, { target: { value: 'securePass123' } });
    fireEvent.change(confirmInput, { target: { value: 'securePass123' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar nueva contraseña/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Enlace inválido o expirado')).toBeInTheDocument();
      expect(
        screen.getByText('El enlace de recuperación ha expirado. Solicitá uno nuevo.')
      ).toBeInTheDocument();
    });
  });

  it('handles confirmPasswordReset failure with weak password error', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=valid-code');
    mockVerifyPasswordResetCode.mockResolvedValueOnce('esteban@example.com');
    const error = new Error('Weak password');
    (error as unknown as { code: string }).code = 'auth/weak-password';
    mockConfirmPasswordReset.mockRejectedValueOnce(error);

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    const passwordInput = await screen.findByPlaceholderText('Mínimo 6 caracteres');
    const confirmInput = screen.getByPlaceholderText('Repetí la nueva contraseña');

    fireEvent.change(passwordInput, { target: { value: 'simple' } });
    fireEvent.change(confirmInput, { target: { value: 'simple' } });

    const submitBtn = screen.getByRole('button', { name: /Guardar nueva contraseña/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'La contraseña es muy débil. Usá al menos 6 caracteres combinando letras y números.'
      );
    });
  });

  it('navigates to login when clicking volver al inicio de sesión in invalid code state', () => {
    window.history.replaceState(null, '', '/reset-password');

    render(
      <MemoryRouter>
        <ResetPassword />
      </MemoryRouter>
    );

    const loginBtn = screen.getByRole('button', { name: /Volver al inicio de sesión/i });
    fireEvent.click(loginBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
