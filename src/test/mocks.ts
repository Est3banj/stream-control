/**
 * Mocks compartidos para tests de StreamControl
 */

import { vi } from 'vitest';
import type { Cliente } from '../types/cliente';

// Mock de Firebase Firestore
export const mockFirestore = {
  collection: vi.fn((db, path) => ({ _path: path, _db: db })),
  doc: vi.fn((db, path, ...ids) => ({ _path: path, _id: ids.join('_'), _db: db })),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp' })),
  increment: vi.fn((n) => ({ _methodName: 'increment', _value: n })),
  Timestamp: {
    now: vi.fn(() => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
    fromDate: vi.fn((d) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
  },
};

// Mock del módulo firebase
export const mockFirebaseModule = {
  db: { _mock: true },
};

// Mock de AuthContext
export const mockUser = {
  uid: 'test-uid-123',
  email: 'test@streamcontrol.com',
  rol: 'usuario',
};

export const mockAuthContext = {
  user: mockUser,
  logout: vi.fn(),
};

// Helper: crear un snapshot simulado de Firestore
export function createDocSnapshot(id: string, data: Record<string, unknown> | null, existsVal = true): {
  id: string;
  exists: () => boolean;
  data: () => Record<string, unknown> | null | undefined;
} {
  return {
    id,
    exists: () => existsVal,
    data: () => existsVal ? data : undefined,
  };
}

// Helper: crear un snapshot de query simulado
export function createQuerySnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return {
    docs,
    empty: docs.length === 0,
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb),
  };
}

// Helper: cliente simulado para tests
export function createMockCliente(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: `test-uid_${overrides.nombre || 'Test'}`,
    nombre: 'Test Client',
    telefono: '3001234567',
    correo: 'test@client.com',
    plataforma: 'Netflix',
    estado: 'activo',
    propietarioId: 'test-uid-123',
    usuarioEmail: 'test@streamcontrol.com',
    fechaVencimiento: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    diasRestantes: 5,
    saldoPendiente: 0,
    ...overrides,
  };
}
