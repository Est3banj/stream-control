import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tutoriales from './Tutoriales';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Tutoriales Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders header, title, summary counter, and all 5 tutorial cards by default', () => {
    render(
      <MemoryRouter>
        <Tutoriales />
      </MemoryRouter>
    );

    // Header title and description
    expect(screen.getByText('Academia & Guías en Video')).toBeInTheDocument();
    expect(
      screen.getByText(/Dominá todas las herramientas de automatización, ventas y cobranza/i)
    ).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Guías Maestras')).toBeInTheDocument();

    // All 5 master tutorials present
    expect(
      screen.getByText('Cómo Registrar una Venta en Stream Control | Guía Paso a Paso')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Módulo de Clientes en Stream Control | Guía Paso a Paso')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Cómo Gestionar Cuentas y Configurar IMAP en Stream Control (Rápido y Fácil)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Registro de Ventas al por Mayor en Stream Control | Guía Paso a Paso')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Stream Control: Configuración del Bot de Telegram Sin Errores')
    ).toBeInTheDocument();
  });

  it('filters tutorial cards by category tabs', () => {
    render(
      <MemoryRouter>
        <Tutoriales />
      </MemoryRouter>
    );

    // Filter by Ventas & CRM
    fireEvent.click(screen.getByRole('button', { name: 'Ventas & CRM' }));
    expect(
      screen.getByText('Cómo Registrar una Venta en Stream Control | Guía Paso a Paso')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Módulo de Clientes en Stream Control | Guía Paso a Paso')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Cómo Gestionar Cuentas y Configurar IMAP en Stream Control (Rápido y Fácil)')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Registro de Ventas al por Mayor en Stream Control | Guía Paso a Paso')
    ).not.toBeInTheDocument();

    // Filter by Automatización IMAP
    fireEvent.click(screen.getByRole('button', { name: 'Automatización IMAP' }));
    expect(
      screen.getByText('Cómo Gestionar Cuentas y Configurar IMAP en Stream Control (Rápido y Fácil)')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Cómo Registrar una Venta en Stream Control | Guía Paso a Paso')
    ).not.toBeInTheDocument();

    // Filter by Mayoristas
    fireEvent.click(screen.getByRole('button', { name: 'Mayoristas' }));
    expect(
      screen.getByText('Registro de Ventas al por Mayor en Stream Control | Guía Paso a Paso')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Cómo Gestionar Cuentas y Configurar IMAP en Stream Control (Rápido y Fácil)')
    ).not.toBeInTheDocument();

    // Filter by Telegram
    fireEvent.click(screen.getByRole('button', { name: 'Telegram' }));
    expect(
      screen.getByText('Stream Control: Configuración del Bot de Telegram Sin Errores')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Registro de Ventas al por Mayor en Stream Control | Guía Paso a Paso')
    ).not.toBeInTheDocument();

    // Return to Todos
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(
      screen.getByText('Cómo Registrar una Venta en Stream Control | Guía Paso a Paso')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Stream Control: Configuración del Bot de Telegram Sin Errores')
    ).toBeInTheDocument();
  });

  it('renders thumbnails for tutorials with youtubeId', () => {
    render(
      <MemoryRouter>
        <Tutoriales />
      </MemoryRouter>
    );

    const thumbnails = screen.getAllByRole('img');
    // 4 tutorials have youtubeId (registro-ventas, gestion-clientes, cuentas-imap, configuracion-telegram)
    expect(thumbnails.length).toBe(4);
    expect(thumbnails[0]).toHaveAttribute(
      'src',
      'https://img.youtube.com/vi/sPGEYdi85uA/hqdefault.jpg'
    );
  });

  it('opens video modal with iframe when clicking Ver Video Tutorial on video with youtubeId', () => {
    render(
      <MemoryRouter>
        <Tutoriales />
      </MemoryRouter>
    );

    const videoButtons = screen.getAllByRole('button', { name: /Ver Video Tutorial/i });
    expect(videoButtons.length).toBe(5);

    // Open first tutorial modal (registro-ventas: sPGEYdi85uA)
    fireEvent.click(videoButtons[0]);

    // Dialog is visible and contains iframe
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const iframe = screen.getByTitle('Cómo Registrar una Venta en Stream Control | Guía Paso a Paso');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/sPGEYdi85uA?rel=0&modestbranding=1&autoplay=1'
    );

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Cerrar modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens video modal with placeholder when tutorial has no youtubeId', () => {
    render(
      <MemoryRouter>
        <Tutoriales />
      </MemoryRouter>
    );

    const videoButtons = screen.getAllByRole('button', { name: /Ver Video Tutorial/i });

    // Open 4th tutorial modal (ventas-mayoristas: no youtubeId)
    fireEvent.click(videoButtons[3]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Video tutorial oficial — Próximamente disponible/i)
    ).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Cerrar modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates to module URL when clicking the secondary module button', () => {
    render(
      <MemoryRouter>
        <Tutoriales />
      </MemoryRouter>
    );

    const moduleBtn = screen.getByRole('button', {
      name: /Ir al módulo de Cómo Registrar una Venta en Stream Control \| Guía Paso a Paso/i,
    });
    fireEvent.click(moduleBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/ventas');
  });
});
