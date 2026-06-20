import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseSuscripciones = vi.fn();
const mockUsePlanes = vi.fn();

vi.mock('../firebase', () => ({
  db: { _mock: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  Timestamp: { fromDate: vi.fn(), now: vi.fn() },
  serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'test-uid', rol: 'admin', email: 'test@test.com' } }),
}));

vi.mock('../hooks/useSuscripciones', () => ({
  default: (...args: unknown[]) => mockUseSuscripciones(...args),
  crearSuscripcion: vi.fn(),
  actualizarSuscripcion: vi.fn(),
  marcarPagada: vi.fn(),
}));

vi.mock('../hooks/usePlanes', () => ({
  default: (...args: unknown[]) => mockUsePlanes(...args),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('AdminSuscripciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSuscripciones.mockReturnValue({ suscripciones: [], loading: false, error: null });
    mockUsePlanes.mockReturnValue({ planes: [], loading: false, error: null });
  });

  it('renders title', async () => {
    const AdminSuscripciones = (await import('./AdminSuscripciones')).default;
    render(<AdminSuscripciones />);

    expect(screen.getByText('Gestión de Suscripciones')).toBeInTheDocument();
    expect(screen.getByText('Administra las suscripciones de los usuarios')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    mockUseSuscripciones.mockReturnValue({ suscripciones: [], loading: true, error: null });

    const AdminSuscripciones = (await import('./AdminSuscripciones')).default;
    render(<AdminSuscripciones />);

    expect(screen.getByText('Cargando suscripciones...')).toBeInTheDocument();
  });

  it('shows filter controls', async () => {
    const AdminSuscripciones = (await import('./AdminSuscripciones')).default;
    render(<AdminSuscripciones />);

    expect(screen.getByText('Todas')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('Expirada')).toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();

    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
  });

  it('shows empty state when no suscripciones', async () => {
    const AdminSuscripciones = (await import('./AdminSuscripciones')).default;
    render(<AdminSuscripciones />);

    expect(screen.getByText('No hay suscripciones registradas')).toBeInTheDocument();
  });

  it('shows create suscripcion button', async () => {
    const AdminSuscripciones = (await import('./AdminSuscripciones')).default;
    render(<AdminSuscripciones />);

    expect(screen.getByRole('button', { name: /crear suscripción/i })).toBeInTheDocument();
  });

  it('shows error banner when error is present', async () => {
    mockUseSuscripciones.mockReturnValue({
      suscripciones: [],
      loading: false,
      error: 'Error al cargar las suscripciones',
    });

    const AdminSuscripciones = (await import('./AdminSuscripciones')).default;
    render(<AdminSuscripciones />);

    expect(screen.getByText('Error al cargar las suscripciones')).toBeInTheDocument();
  });
});
