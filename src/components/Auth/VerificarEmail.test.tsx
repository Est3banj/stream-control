import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VerificarEmail from './VerificarEmail';

const mockNavigate = vi.fn();
const mockEnviarCodigoOTP = vi.fn();
const mockVerificarCodigo = vi.fn();
const mockRefreshUser = vi.fn();
const mockLogout = vi.fn();
const mockUpdateUserEmail = vi.fn();

let mockUser: {
  uid: string;
  email: string;
  correo: string;
  nombre: string;
  emailVerified: boolean;
  rol: string;
} | null = {
  uid: 'usr-100',
  email: 'ana@example.com',
  correo: 'ana@example.com',
  nombre: 'Ana Vendedora',
  emailVerified: false,
  rol: 'usuario',
};

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
    enviarCodigoOTP: mockEnviarCodigoOTP,
    verificarCodigo: mockVerificarCodigo,
    refreshUser: mockRefreshUser,
    logout: mockLogout,
    updateUserEmail: mockUpdateUserEmail,
  }),
}));

let mockAdminConfig = { whatsapp: '' };

vi.mock('../../hooks/useAdminConfig', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAdminConfig')>(
    '../../hooks/useAdminConfig'
  );
  return {
    ...actual,
    useAdminConfig: () => ({ config: mockAdminConfig, loading: false }),
  };
});

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    custom: vi.fn(),
  },
}));

describe('VerificarEmail OTP Flow Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockAdminConfig = { whatsapp: '' };
    mockUser = {
      uid: 'usr-100',
      email: 'ana@example.com',
      correo: 'ana@example.com',
      nombre: 'Ana Vendedora',
      emailVerified: false,
      rol: 'usuario',
    };
  });

  it('renders OTP verification screen with 6 digit inputs and recipient badge', () => {
    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    expect(screen.getByText('Verificación de seguridad')).toBeInTheDocument();
    expect(screen.getByText('StreamControl Pro')).toBeInTheDocument();
    expect(screen.getByText('Seguridad')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el código de 6 dígitos enviado a tu correo')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect(screen.getByText('Verificar código')).toBeInTheDocument();
    expect(screen.getByText(/Reenviar código/i)).toBeInTheDocument();
    expect(screen.getByText('¿Problemas con el registro?')).toBeInTheDocument();
    expect(screen.queryByText('¿Problemas para recibir el código?')).not.toBeInTheDocument();
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });

  it('redirects to /login if user is null', () => {
    mockUser = null;
    render(
      <MemoryRouter initialEntries={['/verificar-email']}>
        <Routes>
          <Route path="/verificar-email" element={<VerificarEmail />} />
          <Route path="/login" element={<div>Página de Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Página de Login')).toBeInTheDocument();
  });

  it('redirects to / if user is already verified or admin', () => {
    mockUser = {
      uid: 'admin-1',
      email: 'admin@streamcontrol.com',
      correo: 'admin@streamcontrol.com',
      nombre: 'Admin',
      emailVerified: true,
      rol: 'admin',
    };

    render(
      <MemoryRouter initialEntries={['/verificar-email']}>
        <Routes>
          <Route path="/verificar-email" element={<VerificarEmail />} />
          <Route path="/" element={<div>Dashboard Principal</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Principal')).toBeInTheDocument();
  });

  it('allows entering 6 digits and verifies automatically on completion', async () => {
    mockVerificarCodigo.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const inputs = screen.getAllByRole('textbox');
    const digits = ['8', '3', '9', '2', '0', '1'];

    digits.forEach((d, i) => {
      fireEvent.change(inputs[i], { target: { value: d } });
    });

    await waitFor(() => {
      expect(mockVerificarCodigo).toHaveBeenCalledWith('839201', 'ana@example.com');
    });

    expect(await screen.findByText('¡Tu cuenta está lista!')).toBeInTheDocument();
  });

  it('displays error message when verification fails with incorrect code', async () => {
    mockVerificarCodigo.mockRejectedValueOnce(
      new Error('Código incorrecto. Te quedan 4 intentos.')
    );

    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const inputs = screen.getAllByRole('textbox');
    const digits = ['1', '1', '1', '2', '2', '2'];

    digits.forEach((d, i) => {
      fireEvent.change(inputs[i], { target: { value: d } });
    });

    await waitFor(() => {
      expect(mockVerificarCodigo).toHaveBeenCalledWith('111222', 'ana@example.com');
      expect(screen.getByText('Código incorrecto. Te quedan 4 intentos.')).toBeInTheDocument();
    });
  });

  it('triggers enviarCodigoOTP when clicking resend button and initiates cooldown', async () => {
    mockEnviarCodigoOTP.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const resendBtn = screen.getByText('Reenviar código');
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(mockEnviarCodigoOTP).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/Reenviar código \(\d+s\)/i)).toBeInTheDocument();
  });

  it('opens CambiarEmailModal when clicking edit and updates email on success', async () => {
    mockUpdateUserEmail.mockResolvedValueOnce(undefined);
    mockEnviarCodigoOTP.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const editBtn = screen.getByTitle('Corregir correo');
    fireEvent.click(editBtn);

    expect(screen.getByText('Corregir correo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ejemplo@dominio.com')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('ejemplo@dominio.com'), {
      target: { value: 'nuevo@dominio.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByText('Actualizar y Enviar'));

    await waitFor(() => {
      expect(mockUpdateUserEmail).toHaveBeenCalledWith('nuevo@dominio.com', 'password123');
    });

    expect(screen.getByText('nuevo@dominio.com')).toBeInTheDocument();
  });

  it('handles logout button', async () => {
    mockLogout.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const logoutBtn = screen.getByText('Cerrar sesión');
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('renders celebration screen when ?verified=true query param is present', async () => {
    render(
      <MemoryRouter initialEntries={['/verificar-email?verified=true']}>
        <VerificarEmail />
      </MemoryRouter>
    );

    expect(await screen.findByText('¡Tu cuenta está lista!')).toBeInTheDocument();
  });

  it('calls all hooks consistently without throwing early return violations across re-renders', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/verificar-email']}>
        <VerificarEmail />
      </MemoryRouter>
    );

    expect(screen.getByText('Verificación de seguridad')).toBeInTheDocument();

    // Re-render when user becomes verified
    mockUser = {
      uid: 'usr-100',
      email: 'ana@example.com',
      correo: 'ana@example.com',
      nombre: 'Ana Vendedora',
      emailVerified: true,
      rol: 'usuario',
    };

    expect(() => {
      rerender(
        <MemoryRouter initialEntries={['/verificar-email']}>
          <VerificarEmail />
        </MemoryRouter>
      );
    }).not.toThrow();
  });

  it('renders WhatsApp support link with default fallback number and custom message in a new tab', () => {
    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const supportLink = screen.getByRole('link', { name: /Contactar soporte/i });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute('target', '_blank');
    expect(supportLink).toHaveAttribute('rel', 'noopener noreferrer');

    const href = supportLink.getAttribute('href') || '';
    expect(href).toContain('https://wa.me/573247349128?text=');
    expect(decodeURIComponent(href)).toContain(
      'Hola, necesito ayuda con la verificación de mi cuenta en StreamControl. Mi correo es: ana@example.com'
    );
  });

  it('renders WhatsApp support link with dynamic configured WhatsApp number from admin config', () => {
    mockAdminConfig = { whatsapp: '+57 (300) 987-6543' };

    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const supportLink = screen.getByRole('link', { name: /Contactar soporte/i });
    expect(supportLink).toBeInTheDocument();

    const href = supportLink.getAttribute('href') || '';
    expect(href).toContain('https://wa.me/573009876543?text=');
  });

  it('updates WhatsApp support link message when email is changed', async () => {
    mockUpdateUserEmail.mockResolvedValueOnce(undefined);
    mockEnviarCodigoOTP.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const editBtn = screen.getByTitle('Corregir correo');
    fireEvent.click(editBtn);

    fireEvent.change(screen.getByPlaceholderText('ejemplo@dominio.com'), {
      target: { value: 'actualizado@dominio.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByText('Actualizar y Enviar'));

    await waitFor(() => {
      const supportLink = screen.getByRole('link', { name: /Contactar soporte/i });
      const href = supportLink.getAttribute('href') || '';
      expect(decodeURIComponent(href)).toContain(
        'Hola, necesito ayuda con la verificación de mi cuenta en StreamControl. Mi correo es: actualizado@dominio.com'
      );
    });
  });
});


