import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VerificarEmail from './VerificarEmail';

const mockNavigate = vi.fn();
const mockSendVerificationEmail = vi.fn();
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
    sendVerificationEmail: mockSendVerificationEmail,
    refreshUser: mockRefreshUser,
    logout: mockLogout,
    updateUserEmail: mockUpdateUserEmail,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    custom: vi.fn(),
  },
}));

describe('VerificarEmail Component Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUser = {
      uid: 'usr-100',
      email: 'ana@example.com',
      correo: 'ana@example.com',
      nombre: 'Ana Vendedora',
      emailVerified: false,
      rol: 'usuario',
    };
  });

  it('renders initial waiting verification state with user email and radar', () => {
    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    expect(screen.getByText('Verificá tu correo')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Sondeo en tiempo real/i)).toBeInTheDocument();
    expect(screen.getByText('Ya lo verifiqué (Comprobar)')).toBeInTheDocument();
    expect(screen.getByText(/Reenviar correo de verificación/i)).toBeInTheDocument();
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

  it('triggers sendVerificationEmail when clicking resend button and initiates cooldown', async () => {
    mockSendVerificationEmail.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <VerificarEmail />
      </MemoryRouter>
    );

    const resendBtn = screen.getByText(/Reenviar correo de verificación/i);
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    // Should now be disabled with countdown
    expect(screen.getByText(/Reenviar correo de verificación \(\d+s\)/i)).toBeInTheDocument();
  });

  it('opens CambiarEmailModal when clicking edit and updates email on success', async () => {
    mockUpdateUserEmail.mockResolvedValueOnce(undefined);
    mockSendVerificationEmail.mockResolvedValueOnce(undefined);

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

  it('renders success celebration and allows instant navigation to dashboard', async () => {
    mockRefreshUser.mockResolvedValueOnce(true);

    render(
      <MemoryRouter initialEntries={['/verificar-email?verified=true']}>
        <VerificarEmail />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('¡Tu cuenta está lista!')).toBeInTheDocument();
    });

    expect(screen.getByText('¡Verificación confirmada!')).toBeInTheDocument();
    const enterBtn = screen.getByText('Entrar ahora');
    fireEvent.click(enterBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});
