import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
const mockOnSnapshot = vi.fn<AnyFn>();
const mockAddDoc = vi.fn<AnyFn>();
const mockUpdateDoc = vi.fn<AnyFn>();
const mockDeleteDoc = vi.fn<AnyFn>();
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
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
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

describe('usePlanes', () => {
  let usePlanes: (user: { uid?: string; rol?: string } | null) => {
    planes: any[];
    loading: boolean;
    error: string | null;
  };
  let crearPlan: (data: any) => Promise<string>;
  let actualizarPlan: (id: string, data: any) => Promise<void>;
  let eliminarPlan: (id: string) => Promise<void>;
  const mockUser = { uid: 'test-uid', rol: 'admin' };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('./usePlanes');
    usePlanes = mod.default;
    crearPlan = mod.crearPlan;
    actualizarPlan = mod.actualizarPlan;
    eliminarPlan = mod.eliminarPlan;
  });

  it('loads planes on mount', async () => {
    mockOnSnapshot.mockImplementation((_q: unknown, onNext: (snapshot: ReturnType<typeof createQuerySnapshot>) => void) => {
      const snapshot = createQuerySnapshot([
        createDocSnapshot('plan1', {
          nombre: 'Premium',
          precio: 29900,
          duracionDias: 30,
          features: ['feature1', 'feature2'],
          activo: true,
        }),
      ]);
      setTimeout(() => onNext(snapshot), 0);
      return vi.fn();
    });

    const { result } = renderHook(() => usePlanes(mockUser));

    await waitFor(() => {
      expect(result.current.planes).toHaveLength(1);
    });

    expect(result.current.planes[0].nombre).toBe('Premium');
    expect(result.current.planes[0].precio).toBe(29900);
    expect(result.current.planes[0].duracionDias).toBe(30);
    expect(result.current.loading).toBe(false);
  });

  it('crearPlan calls addDoc', async () => {
    mockAddDoc.mockResolvedValue({ id: 'new-plan-id' });

    const planData = {
      nombre: 'Basic',
      descripcion: 'Plan básico',
      precio: 19900,
      duracionDias: 30,
      features: ['feat1'],
      activo: true,
    };

    const id = await crearPlan(planData);

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      ...planData,
      createdAt: { _methodName: 'serverTimestamp' },
    });
    expect(id).toBe('new-plan-id');
  });

  it('actualizarPlan calls updateDoc', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await actualizarPlan('plan-1', { precio: 35000 });

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'planes', 'plan-1');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { precio: 35000 });
  });

  it('eliminarPlan calls deleteDoc when no active subscriptions', async () => {
    mockGetDocs.mockResolvedValue(createQuerySnapshot([]));
    mockDeleteDoc.mockResolvedValue(undefined);

    await eliminarPlan('plan-1');

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'planes', 'plan-1');
  });

  it('eliminarPlan throws when plan has active subscriptions', async () => {
    mockGetDocs.mockResolvedValue(
      createQuerySnapshot([createDocSnapshot('sub1', { planId: 'plan1', estado: 'activa' })]),
    );

    await expect(eliminarPlan('plan-1')).rejects.toThrow(
      'No se puede eliminar: el plan tiene suscripciones activas',
    );
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('handles onSnapshot errors gracefully', async () => {
    mockOnSnapshot.mockImplementation(
      (_q: unknown, _onNext: Function, onError: (err: Error) => void) => {
        setTimeout(() => onError(new Error('Error de conexión con Firebase')), 0);
        return vi.fn();
      },
    );

    const { result } = renderHook(() => usePlanes(mockUser));

    await waitFor(() => {
      expect(result.current.error).toBe('Error de conexión con Firebase');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.planes).toEqual([]);
  });

  it('returns empty when user is null', () => {
    const { result } = renderHook(() => usePlanes(null));

    expect(result.current.planes).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
