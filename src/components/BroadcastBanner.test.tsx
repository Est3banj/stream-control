import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BroadcastBanner from './BroadcastBanner';

const mockUseBroadcastBanner = vi.fn();

vi.mock('../hooks/useBroadcastBanner', () => ({
  useBroadcastBanner: () => mockUseBroadcastBanner(),
}));

describe('BroadcastBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders nothing when broadcast is inactive or empty', () => {
    mockUseBroadcastBanner.mockReturnValue({
      broadcast: { activo: false, mensaje: '', tipo: 'info' },
      loading: false,
    });

    const { container } = render(<BroadcastBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders announcement message and badge when broadcast is active', () => {
    mockUseBroadcastBanner.mockReturnValue({
      broadcast: { activo: true, mensaje: 'Mantenimiento del servidor a las 23:00 UTC', tipo: 'warning' },
      loading: false,
    });

    render(<BroadcastBanner />);
    expect(screen.getByText('AVISO')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento del servidor a las 23:00 UTC')).toBeInTheDocument();
  });

  it('allows user to dismiss the banner with close button', () => {
    mockUseBroadcastBanner.mockReturnValue({
      broadcast: { activo: true, mensaje: 'Aviso importante para todos los usuarios', tipo: 'info' },
      loading: false,
    });

    render(<BroadcastBanner />);
    expect(screen.getByText('Aviso importante para todos los usuarios')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Cerrar anuncio');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Aviso importante para todos los usuarios')).not.toBeInTheDocument();
  });
});
