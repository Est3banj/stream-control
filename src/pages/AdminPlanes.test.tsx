import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUsePlanes = vi.fn();
const mockUseSuscripciones = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'test-uid', rol: 'admin', email: 'test@test.com' } }),
}));

vi.mock('../hooks/usePlanes', () => ({
  default: (...args: unknown[]) => mockUsePlanes(...args),
  crearPlan: vi.fn(),
  actualizarPlan: vi.fn(),
  togglePlanActive: vi.fn(),
  eliminarPlan: vi.fn(),
}));

vi.mock('../hooks/useSuscripciones', () => ({
  default: (...args: unknown[]) => mockUseSuscripciones(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('AdminPlanes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSuscripciones.mockReturnValue({ suscripciones: [], loading: false, error: null });
  });

  it('renders title and create button', async () => {
    mockUsePlanes.mockReturnValue({ planes: [], loading: false, error: null });

    const AdminPlanes = (await import('./AdminPlanes')).default;
    render(<AdminPlanes />);

    expect(screen.getByText('Gestión de Planes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear plan/i })).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    mockUsePlanes.mockReturnValue({ planes: [], loading: true, error: null });

    const AdminPlanes = (await import('./AdminPlanes')).default;
    render(<AdminPlanes />);

    expect(screen.getByText('Cargando planes...')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    mockUsePlanes.mockReturnValue({ planes: [], loading: false, error: null });

    const AdminPlanes = (await import('./AdminPlanes')).default;
    render(<AdminPlanes />);

    expect(screen.getByText('No hay planes creados')).toBeInTheDocument();
  });

  it('renders plan rows', async () => {
    const mockPlanes = [
      {
        id: 'plan1',
        nombre: 'Premium',
        descripcion: 'Plan premium con todo incluido',
        precio: 29900,
        duracionDias: 30,
        features: ['feature1', 'feature2'],
        activo: true,
      },
      {
        id: 'plan2',
        nombre: 'Basic',
        descripcion: 'Plan básico',
        precio: 9900,
        duracionDias: 15,
        features: ['feature1'],
        activo: false,
      },
    ];
    mockUsePlanes.mockReturnValue({ planes: mockPlanes, loading: false, error: null });

    const AdminPlanes = (await import('./AdminPlanes')).default;
    render(<AdminPlanes />);

    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getAllByText('Activo')).toHaveLength(2);
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('shows error banner when error is present', async () => {
    mockUsePlanes.mockReturnValue({
      planes: [],
      loading: false,
      error: 'Error al cargar los planes',
    });

    const AdminPlanes = (await import('./AdminPlanes')).default;
    render(<AdminPlanes />);

    expect(screen.getByText('Error al cargar los planes')).toBeInTheDocument();
  });
});
