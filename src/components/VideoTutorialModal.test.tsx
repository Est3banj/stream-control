import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VideoTutorialModal from './VideoTutorialModal';
import type { Tutorial } from '../data/tutoriales';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const sampleTutorialWithoutVideo: Tutorial = {
  id: 'registro-ventas',
  titulo: 'Cómo registrar ventas individuales y combos multi-servicio',
  descripcion: 'Aprende a emitir ventas de cuentas completas con cálculo automático.',
  categoria: 'ventas',
  badge: 'Ventas & Facturación',
  duracionEstimada: '3:45 min',
  youtubeId: '',
  urlDestino: '/ventas',
  botonTexto: 'Ir a Registrar Venta',
  pasosClave: [
    'Paso 1: Seleccionar tipo de venta',
    'Paso 2: Completar cliente y teléfono',
    'Paso 3: Confirmar transacción',
  ],
  icono: 'DollarSign',
};

const sampleTutorialWithVideo: Tutorial = {
  ...sampleTutorialWithoutVideo,
  youtubeId: 'abc123xyz',
};

describe('VideoTutorialModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders null when tutorial is null', () => {
    const { container } = render(
      <MemoryRouter>
        <VideoTutorialModal tutorial={null} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders visual placeholder and step-by-step checklist when youtubeId is empty', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <VideoTutorialModal tutorial={sampleTutorialWithoutVideo} onClose={handleClose} />
      </MemoryRouter>
    );

    // Header info
    expect(screen.getByText('Cómo registrar ventas individuales y combos multi-servicio')).toBeInTheDocument();
    expect(screen.getByText('Ventas & Facturación')).toBeInTheDocument();
    expect(screen.getByText('3:45 min')).toBeInTheDocument();

    // Placeholder elements
    expect(screen.getByText(/Video tutorial oficial — Próximamente disponible/i)).toBeInTheDocument();

    // Checklist steps
    expect(screen.getByText('Paso 1: Seleccionar tipo de venta')).toBeInTheDocument();
    expect(screen.getByText('Paso 2: Completar cliente y teléfono')).toBeInTheDocument();
    expect(screen.getByText('Paso 3: Confirmar transacción')).toBeInTheDocument();

    // CTA button
    expect(screen.getByRole('button', { name: /Ir a Registrar Venta/i })).toBeInTheDocument();
  });

  it('renders iframe embed when youtubeId is present', () => {
    render(
      <MemoryRouter>
        <VideoTutorialModal tutorial={sampleTutorialWithVideo} onClose={vi.fn()} />
      </MemoryRouter>
    );

    const iframe = screen.getByTitle('Cómo registrar ventas individuales y combos multi-servicio');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/abc123xyz?rel=0&modestbranding=1&autoplay=1'
    );
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <VideoTutorialModal tutorial={sampleTutorialWithoutVideo} onClose={handleClose} />
      </MemoryRouter>
    );

    const closeBtn = screen.getByRole('button', { name: /Cerrar modal/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when secondary Cerrar button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <VideoTutorialModal tutorial={sampleTutorialWithoutVideo} onClose={handleClose} />
      </MemoryRouter>
    );

    const closeSecondaryBtn = screen.getByRole('button', { name: /^Cerrar$/i });
    fireEvent.click(closeSecondaryBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <VideoTutorialModal tutorial={sampleTutorialWithoutVideo} onClose={handleClose} />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to urlDestino and closes modal when clicking CTA button', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <VideoTutorialModal tutorial={sampleTutorialWithoutVideo} onClose={handleClose} />
      </MemoryRouter>
    );

    const ctaBtn = screen.getByRole('button', { name: /Ir a Registrar Venta/i });
    fireEvent.click(ctaBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/ventas');
  });

  it('closes when clicking backdrop', () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <VideoTutorialModal tutorial={sampleTutorialWithoutVideo} onClose={handleClose} />
      </MemoryRouter>
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
