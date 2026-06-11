import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks de Firebase - se definen antes de cualquier import
const mockOnSnapshot = vi.fn();

vi.mock('../firebase', () => ({
  db: { _mock: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

function createDocSnapshot<T extends Record<string, unknown>>(id: string, data: T) {
  return {
    id,
    data: () => data,
    exists: () => true,
  };
}

function createQuerySnapshot<T>(docs: T[]) {
  return { docs, empty: docs.length === 0 };
}

describe('useClientes', () => {
  let useClientes: (user: { uid: string; email: string; rol: string } | null) => { clientes: any[]; loading: boolean };
  const mockUser = { uid: 'test-uid', email: 'test@test.com', rol: 'usuario' };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Resetear el módulo para que el singleton se reinicie en cada test
    vi.resetModules();
    const mod = await import('./useClientes');
    useClientes = mod.default;
  });

  it('returns clientes with computed diasRestantes', async () => {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 5);
    const fechaStr = futureDate.toISOString().split('T')[0];

    mockOnSnapshot.mockImplementation((q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([
        createDocSnapshot('uid_Cliente1', {
          nombre: 'Cliente1',
          telefono: '3001112233',
          plataforma: 'Netflix',
          propietarioId: 'test-uid',
          fechaVencimiento: fechaStr,
          estado: 'activo',
        }),
      ]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useClientes(mockUser));

    await waitFor(() => {
      expect(result.current.clientes).toHaveLength(1);
    });

    expect(result.current.clientes[0].nombre).toBe('Cliente1');
    expect(result.current.clientes[0].diasRestantes).toBe(5);
  });

  it('sets diasRestantes to null when no fechaVencimiento', async () => {
    mockOnSnapshot.mockImplementation((q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([
        createDocSnapshot('uid_Cliente1', {
          nombre: 'Cliente1',
          propietarioId: 'test-uid',
          estado: 'activo',
        }),
      ]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useClientes(mockUser));

    await waitFor(() => {
      expect(result.current.clientes).toHaveLength(1);
    });

    expect(result.current.clientes[0].diasRestantes).toBeNull();
  });

  it('handles expired clientes (negative diasRestantes)', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const fechaStr = pastDate.toISOString().split('T')[0];

    mockOnSnapshot.mockImplementation((q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([
        createDocSnapshot('uid_Expired', {
          nombre: 'Expired',
          propietarioId: 'test-uid',
          fechaVencimiento: fechaStr,
          estado: 'activo',
        }),
      ]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useClientes(mockUser));

    await waitFor(() => {
      expect(result.current.clientes).toHaveLength(1);
    });

    expect(result.current.clientes[0].diasRestantes).toBe(-3);
  });

  it('returns empty array when user is null', () => {
    const { result } = renderHook(() => useClientes(null));

    expect(result.current.clientes).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
