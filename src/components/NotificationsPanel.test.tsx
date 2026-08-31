import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationsPanel from './NotificationsPanel';

const mockUseClientesConNotificaciones = vi.fn();
const mockUseAnunciosGlobales = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', rol: 'user', email: 'user@example.com' } }),
}));

vi.mock('../hooks/useMoneda', () => ({
  useMoneda: () => ({ formatear: (val: number) => `$${val}` }),
}));

vi.mock('../hooks/useClientesConNotificaciones', () => ({
  default: () => mockUseClientesConNotificaciones(),
}));

vi.mock('../hooks/useAnunciosGlobales', () => ({
  useAnunciosGlobales: () => mockUseAnunciosGlobales(),
}));

describe('NotificationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUseClientesConNotificaciones.mockReturnValue({ notificaciones: [], loading: false });
    mockUseAnunciosGlobales.mockReturnValue({ anuncios: [], loading: false });
  });

  it('renders bell button without badge when no unread notifications exist', () => {
    render(<NotificationsPanel />);
    const bellBtn = screen.getByRole('button', { name: /notificaciones/i });
    expect(bellBtn).toBeInTheDocument();
    expect(screen.queryByText(/^[0-9]+$/)).not.toBeInTheDocument();
  });

  it('renders unread indicator dot and count when there are announcements and client notifs', () => {
    mockUseAnunciosGlobales.mockReturnValue({
      anuncios: [
        {
          id: 'anuncio-promo-1',
          titulo: '¡50% de Descuento en Plan Anual!',
          mensaje: 'Aprovechá la oferta especial para renovar tu suscripción.',
          tipo: 'promocion',
          linkBoton: 'https://streamcontrol.pro',
          textoBoton: 'Aprovechar Oferta',
          activo: true,
        },
      ],
      loading: false,
    });

    mockUseClientesConNotificaciones.mockReturnValue({
      notificaciones: [
        {
          id: 'notif-vence-1',
          nombreCliente: 'Juan Pérez',
          plataforma: 'Netflix',
          diasRestantes: 1,
          tipo: 'vencimiento',
        },
      ],
      loading: false,
    });

    render(<NotificationsPanel />);

    // Total unread = 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays platform announcement with sleek badge (Promoción), message and CTA button', () => {
    mockUseAnunciosGlobales.mockReturnValue({
      anuncios: [
        {
          id: 'anuncio-promo-1',
          titulo: 'Black Friday Streaming',
          mensaje: 'Renová con 30% de descuento.',
          tipo: 'promocion',
          linkBoton: 'https://streamcontrol.pro/promo',
          textoBoton: 'Obtener Descuento',
          activo: true,
        },
      ],
      loading: false,
    });

    render(<NotificationsPanel />);

    const bellBtn = screen.getByRole('button', { name: /notificaciones/i });
    fireEvent.click(bellBtn);

    expect(screen.getByText('Promoción')).toBeInTheDocument();
    expect(screen.getByText('Black Friday Streaming')).toBeInTheDocument();
    expect(screen.getByText('Renová con 30% de descuento.')).toBeInTheDocument();
    const ctaBtn = screen.getByRole('link', { name: /obtener descuento/i });
    expect(ctaBtn).toHaveAttribute('href', 'https://streamcontrol.pro/promo');
  });

  it('displays different announcement types (Comunicado, Vencimiento de Plan, Novedad)', () => {
    mockUseAnunciosGlobales.mockReturnValue({
      anuncios: [
        { id: 'a1', titulo: 'Aviso de Mantenimiento', mensaje: 'Breve corte.', tipo: 'comunicado', activo: true },
        { id: 'a2', titulo: 'Tu Plan Vence Pronto', mensaje: 'Evitá cortes.', tipo: 'vencimiento', activo: true },
        { id: 'a3', titulo: 'Nueva App Móvil PWA', mensaje: 'Instalala hoy.', tipo: 'novedad', activo: true },
      ],
      loading: false,
    });

    render(<NotificationsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /notificaciones/i }));

    expect(screen.getByText('Comunicado')).toBeInTheDocument();
    expect(screen.getByText('Vencimiento de Plan')).toBeInTheDocument();
    expect(screen.getByText('Novedad')).toBeInTheDocument();
  });

  it('marks individual announcement as read and updates unread count', () => {
    mockUseAnunciosGlobales.mockReturnValue({
      anuncios: [
        { id: 'a1', titulo: 'Aviso 1', mensaje: 'Mensaje 1', tipo: 'comunicado', activo: true },
        { id: 'a2', titulo: 'Aviso 2', mensaje: 'Mensaje 2', tipo: 'novedad', activo: true },
      ],
      loading: false,
    });

    render(<NotificationsPanel />);

    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /notificaciones/i }));

    const dismissBtns = screen.getAllByRole('button', { name: /marcar como leída/i });
    fireEvent.click(dismissBtns[0]);

    // Queda 1 no leída
    expect(screen.queryByText('Aviso 1')).not.toBeInTheDocument();
    expect(screen.getByText('Aviso 2')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('marks all notifications as read when clicking "Marcar todas como leídas"', () => {
    mockUseAnunciosGlobales.mockReturnValue({
      anuncios: [
        { id: 'a1', titulo: 'Aviso 1', mensaje: 'Mensaje 1', tipo: 'comunicado', activo: true },
        { id: 'a2', titulo: 'Aviso 2', mensaje: 'Mensaje 2', tipo: 'novedad', activo: true },
      ],
      loading: false,
    });

    render(<NotificationsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /notificaciones/i }));

    const markAllBtn = screen.getByText('Marcar todas como leídas');
    fireEvent.click(markAllBtn);

    expect(screen.getByText('No hay notificaciones')).toBeInTheDocument();
  });
});
