import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UsuarioDrawer from './UsuarioDrawer';
import type { Usuario } from '../../types/usuario';
import type { Suscripcion } from '../../types/suscripcion';

vi.mock('../../firebase', () => ({
  db: { _mock: true },
  auth: { currentUser: null },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'admin-1', rol: 'admin', email: 'admin@streamcontrol.com' } }),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    size: 5,
    docs: [
      { data: () => ({ precioVenta: 15000, pantallas: 2 }) },
      { data: () => ({ precioVenta: 20000, pantallas: 1 }) },
    ],
  }),
  doc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  Timestamp: {
    fromDate: vi.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
    now: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/apiClient', () => ({
  callFunction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../hooks/useSuscripciones', () => ({
  actualizarSuscripcion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('UsuarioDrawer', () => {
  const mockUsuario: Usuario = {
    id: 'user-tenant-1',
    nombre: 'Elena Morales',
    correo: 'elena@stream.com',
    rol: 'usuario',
    estado: 'activo',
    activoHasta: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    emailVerified: true,
  };

  const mockSuscripcion: Suscripcion = {
    id: 'sub-elena-1',
    usuarioId: 'user-tenant-1',
    usuarioNombre: 'Elena Morales',
    planId: 'plan-pro',
    planNombre: 'Pro Mensual',
    fechaInicio: { seconds: Math.floor(Date.now() / 1000) - 86400 * 10, nanoseconds: 0 } as any,
    fechaFin: { seconds: Math.floor(Date.now() / 1000) + 86400 * 20, nanoseconds: 0 } as any,
    estado: 'activa',
    pagoEstado: 'pagado',
    monto: 45000,
    createdAt: { seconds: 1600000000, nanoseconds: 0 } as any,
    updatedAt: { seconds: 1600000000, nanoseconds: 0 } as any,
  };

  it('renders user details, verification badge and active subscription', async () => {
    render(
      <UsuarioDrawer
        usuario={mockUsuario}
        isOpen={true}
        onClose={vi.fn()}
        suscripcionActiva={mockSuscripcion}
        planes={[]}
        isVerificado={true}
      />
    );

    expect(screen.getByText('Elena Morales')).toBeInTheDocument();
    expect(screen.getByText('elena@stream.com')).toBeInTheDocument();
    expect(screen.getByText('Email Verificado')).toBeInTheDocument();
    expect(screen.getByText('Pro Mensual')).toBeInTheDocument();
  });

  it('fetches on-demand telemetry for Clientes, Cuentas and Sales volume', async () => {
    render(
      <UsuarioDrawer
        usuario={mockUsuario}
        isOpen={true}
        onClose={vi.fn()}
        suscripcionActiva={mockSuscripcion}
        planes={[]}
        isVerificado={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Telemetría de Uso (En Vivo)')).toBeInTheDocument();
      expect(screen.getByText('Clientes')).toBeInTheDocument();
      expect(screen.getByText('Cuentas')).toBeInTheDocument();
      expect(screen.getByText('Volumen')).toBeInTheDocument();
    });
  });

  it('allows extending grace days with +7 Días button', async () => {
    render(
      <UsuarioDrawer
        usuario={mockUsuario}
        isOpen={true}
        onClose={vi.fn()}
        suscripcionActiva={mockSuscripcion}
        planes={[]}
        isVerificado={true}
      />
    );

    const btn7d = screen.getByRole('button', { name: /\+7 días/i });
    fireEvent.click(btn7d);

    await waitFor(() => {
      expect(screen.getByText('Acciones de Soporte Rápido')).toBeInTheDocument();
    });
  });
});
