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
  addDoc: vi.fn().mockResolvedValue({ id: 'new-cuenta-id' }),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue({ _mockTimestamp: true }),
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

describe('useCuentas', () => {
  let useCuentas: (user: { uid: string; rol: string } | null) => { cuentas: any[]; loading: boolean; error: string | null };
  const mockUser = { uid: 'test-uid', rol: 'usuario' };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('./useCuentas');
    useCuentas = mod.default;
  });

  it('initializes with loading state', () => {
    mockOnSnapshot.mockImplementation(() => vi.fn());
    const { result } = renderHook(() => useCuentas(mockUser));
    expect(result.current.loading).toBe(true);
  });

  it('returns cuentas data from snapshot', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([
        createDocSnapshot('cuenta1', {
          proveedor: 'Netflix',
          correoCuenta: 'netflix@test.com',
          costo: 30000,
          tipoVenta: 'perfiles',
          perfiles: [
            { nombre: 'Perfil 1', pin: '', estado: 'disponible' },
            { nombre: 'Perfil 2', pin: '1234', estado: 'disponible' },
          ],
          estado: 'disponible',
          propietarioId: 'test-uid',
        }),
        createDocSnapshot('cuenta2', {
          proveedor: 'Max',
          correoCuenta: 'max@test.com',
          costo: 25000,
          tipoVenta: 'completa',
          perfiles: [],
          estado: 'disponible',
          propietarioId: 'test-uid',
        }),
      ]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useCuentas(mockUser));

    await waitFor(() => {
      expect(result.current.cuentas).toHaveLength(2);
    });

    expect(result.current.cuentas[0].proveedor).toBe('Netflix');
    expect(result.current.cuentas[0].perfiles).toHaveLength(2);
    expect(result.current.cuentas[1].proveedor).toBe('Max');
    expect(result.current.loading).toBe(false);
  });

  it('returns empty array when user is null', () => {
    const { result } = renderHook(() => useCuentas(null));

    expect(result.current.cuentas).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('handles snapshot error', async () => {
    const testError = new Error('Permission denied');
    mockOnSnapshot.mockImplementation((_q: unknown, _onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void, onError: (err: Error) => void) => {
      setTimeout(() => onError(testError), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useCuentas(mockUser));

    await waitFor(() => {
      expect(result.current.error).toBe('Permission denied');
    });

    expect(result.current.cuentas).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
