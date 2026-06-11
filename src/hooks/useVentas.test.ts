import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('useVentas', () => {
  let useVentas: (user: { uid: string; email: string; rol: string } | null) => { ventas: any[]; loading: boolean };
  const mockUser = { uid: 'test-uid', email: 'test@test.com', rol: 'usuario' };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('./useVentas');
    useVentas = mod.default;
  });

  it('returns ventas from snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([
        createDocSnapshot('venta1', {
          nombre: 'Cliente A',
          plataforma: 'Netflix',
          pantallas: 2,
          precioVenta: 15000,
          costoServicio: 5000,
          utilidad: 25000,
          propietarioId: 'test-uid',
          fechaVencimiento: '2026-07-01',
        }),
      ]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useVentas(mockUser));

    await waitFor(() => {
      expect(result.current.ventas).toHaveLength(1);
    });

    expect(result.current.ventas[0].id).toBe('venta1');
    expect(result.current.ventas[0].plataforma).toBe('Netflix');
    expect(result.current.ventas[0].utilidad).toBe(25000);
  });

  it('returns empty array when user is null', () => {
    const { result } = renderHook(() => useVentas(null));

    expect(result.current.ventas).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('handles empty snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useVentas(mockUser));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.ventas).toEqual([]);
  });

  it('maps document fields correctly', async () => {
    const mockData = {
      nombre: 'Cliente B',
      plataforma: 'Disney+',
      pantallas: 1,
      precioVenta: 12000,
      costoServicio: 3000,
      utilidad: 9000,
      propietarioId: 'test-uid',
      fechaVencimiento: '2026-08-15',
      pagado: true,
      saldoPendiente: 0,
    };

    mockOnSnapshot.mockImplementation((q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([
        createDocSnapshot('venta2', mockData),
      ]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useVentas(mockUser));

    await waitFor(() => {
      expect(result.current.ventas).toHaveLength(1);
    });

    expect(result.current.ventas[0].pagado).toBe(true);
    expect(result.current.ventas[0].saldoPendiente).toBe(0);
  });
});
