import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockOnSnapshot = vi.fn<AnyFn>();
const mockAddDoc = vi.fn<AnyFn>();
const mockUpdateDoc = vi.fn<AnyFn>();
const mockGetDocs = vi.fn<AnyFn>();
const mockCollection = vi.fn<AnyFn>().mockImplementation((_db: unknown, path: string) => ({ _path: path }));
const mockDoc = vi.fn<AnyFn>().mockImplementation((_db: unknown, path: string, ...ids: string[]) => ({ _path: path, _id: ids.join('_') }));
const mockQuery = vi.fn<AnyFn>();
const mockWhere = vi.fn<AnyFn>();

vi.mock('../firebase', () => ({
  db: { _mock: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
}));

function createDocSnapshot<T extends Record<string, unknown>>(id: string, data: T) {
  return { id, data: () => data, exists: () => true };
}

function createQuerySnapshot<T>(docs: T[]) {
  return { docs, empty: docs.length === 0 };
}

const mockTimestamp = { seconds: 1000, nanoseconds: 0 };

describe('useSuscripciones', () => {
  let useSuscripciones: (user: { uid?: string; rol?: string } | null) => {
    suscripciones: any[];
    loading: boolean;
    error: string | null;
  };
  let crearSuscripcion: (data: any) => Promise<string>;
  let actualizarSuscripcion: (id: string, data: any) => Promise<void>;
  let marcarPagada: (id: string) => Promise<void>;
  const mockUser = { uid: 'test-uid', rol: 'admin' };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('./useSuscripciones');
    useSuscripciones = mod.default;
    crearSuscripcion = mod.crearSuscripcion;
    actualizarSuscripcion = mod.actualizarSuscripcion;
    marcarPagada = mod.marcarPagada;
  });

  it('loads suscripciones on mount', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([
        createDocSnapshot('sub1', {
          usuarioId: 'user1',
          usuarioNombre: 'User 1',
          planId: 'plan1',
          planNombre: 'Premium',
          fechaInicio: mockTimestamp,
          fechaFin: mockTimestamp,
          estado: 'activa',
          pagoEstado: 'pagado',
          monto: 29900,
        }),
      ]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => useSuscripciones(mockUser));

    await waitFor(() => {
      expect(result.current.suscripciones).toHaveLength(1);
    });

    expect(result.current.suscripciones[0].usuarioNombre).toBe('User 1');
    expect(result.current.suscripciones[0].planNombre).toBe('Premium');
    expect(result.current.suscripciones[0].monto).toBe(29900);
    expect(result.current.loading).toBe(false);
  });

  it('crearSuscripcion calls addDoc and returns the new id', async () => {
    mockGetDocs.mockResolvedValue(createQuerySnapshot([]));
    mockAddDoc.mockResolvedValue({ id: 'new-susc-id' });

    const suscData = {
      usuarioId: 'user1',
      usuarioNombre: 'User 1',
      planId: 'plan1',
      planNombre: 'Premium',
      fechaInicio: mockTimestamp,
      fechaFin: mockTimestamp,
      estado: 'activa' as const,
      pagoEstado: 'pendiente' as const,
      monto: 29900,
    };

    const id = await crearSuscripcion(suscData);

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      ...suscData,
      createdAt: { _methodName: 'serverTimestamp' },
      updatedAt: { _methodName: 'serverTimestamp' },
    });
    // Ya no se actualiza plan en el documento del usuario (usePermisos lee desde suscripciones)
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(id).toBe('new-susc-id');
  });

  it('crearSuscripcion throws if user already has active subscription', async () => {
    mockGetDocs.mockResolvedValue(
      createQuerySnapshot([createDocSnapshot('existing', { usuarioId: 'user1', estado: 'activa' })]),
    );

    await expect(
      crearSuscripcion({
        usuarioId: 'user1',
        usuarioNombre: 'User 1',
        planId: 'plan1',
        planNombre: 'Premium',
        fechaInicio: mockTimestamp,
        fechaFin: mockTimestamp,
        estado: 'activa',
        pagoEstado: 'pendiente',
        monto: 29900,
      }),
    ).rejects.toThrow('El usuario ya tiene una suscripción activa');

    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('actualizarSuscripcion calls updateDoc', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await actualizarSuscripcion('sub-1', { estado: 'cancelada' });

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'suscripciones', 'sub-1');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
      estado: 'cancelada',
      updatedAt: { _methodName: 'serverTimestamp' },
    });
  });

  it('marcarPagada calls updateDoc with pagoEstado pagado', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await marcarPagada('sub-1');

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'suscripciones', 'sub-1');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
      pagoEstado: 'pagado',
      updatedAt: { _methodName: 'serverTimestamp' },
    });
  });

  it('handles onSnapshot errors gracefully', async () => {
    mockOnSnapshot.mockImplementation(
      (_q: unknown, _onNext: Function, onError: (err: Error) => void) => {
        setTimeout(() => onError(new Error('Error al cargar suscripciones')), 0);
        return vi.fn();
      },
    );

    const { result } = renderHook(() => useSuscripciones(mockUser));

    await waitFor(() => {
      expect(result.current.error).toBe('Error al cargar suscripciones');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.suscripciones).toEqual([]);
  });

  it('returns empty when user is null', () => {
    const { result } = renderHook(() => useSuscripciones(null));

    expect(result.current.suscripciones).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
