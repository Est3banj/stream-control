/**
 * Backend fake compartido para los tests de api/ (AD-9):
 * singleton de Firestore fake + Auth fake + helper setToken.
 *
 * Uso:
 *   import { backend, mockFirebaseModule } from './helpers/setupFirebase';
 *   vi.mock('../src/firebase', () => mockFirebaseModule());
 *   beforeEach(() => backend.reset());
 *
 * Convención de tokens: el valor del Bearer ES el uid (no se verifica JWT real).
 *   backend.auth.setToken('tk-admin', { uid: 'uid-admin', role: 'admin' });
 *   Authorization: Bearer tk-admin  →  req.auth.uid === 'uid-admin'
 */

import { vi } from 'vitest';
import { createFirestoreFake, type FirestoreFake } from './firestoreFake.js';

export interface FakeAuthUser {
  uid: string;
  emailVerified: boolean;
  providerData: Array<{ providerId: string }>;
  metadata: { creationTime?: string };
}

export interface AuthFake {
  setToken(token: string, decoded: Record<string, unknown>): void;
  addAuthUser(user: FakeAuthUser): void;
  verifyIdToken: ReturnType<typeof vi.fn>;
  generatePasswordResetLink: ReturnType<typeof vi.fn>;
  generateEmailVerificationLink: ReturnType<typeof vi.fn>;
  listUsers: ReturnType<typeof vi.fn>;
  deleteUser: ReturnType<typeof vi.fn>;
  updateUser: ReturnType<typeof vi.fn>;
  getUserByEmail: ReturnType<typeof vi.fn>;
}

function makeAuthFake(): AuthFake {
  const tokens = new Map<string, Record<string, unknown>>();
  const users: FakeAuthUser[] = [];

  const withInvalid = (token: string): boolean => token === 'invalid' || token === 'expired' || token === 'revoked';

  const auth: AuthFake = {
    setToken(token: string, decoded: Record<string, unknown>) {
      tokens.set(token, { uid: token, email: 'test@example.com', role: 'user', ...decoded });
    },
    addAuthUser(user: FakeAuthUser) {
      users.push(user);
    },
    verifyIdToken: vi.fn(async (token: string) => {
      if (withInvalid(token)) {
        throw new Error('Firebase ID token has expired');
      }
      const decoded = tokens.get(token);
      if (!decoded) {
        throw new Error('invalid token');
      }
      return { ...decoded };
    }),
    generatePasswordResetLink: vi.fn(async () => 'https://streamcontrol-10837.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=fake-oob-code-123&apiKey=fake-api-key-456'),
    generateEmailVerificationLink: vi.fn(async () => 'https://verify.example/link'),
    listUsers: vi.fn(async (_max: number, _pageToken?: string) => ({
      users: [...users],
      pageToken: undefined,
    })),
    deleteUser: vi.fn(async () => undefined),
    updateUser: vi.fn(async (_uid: string, _data: Record<string, unknown>) => undefined),
    getUserByEmail: vi.fn(async (email: string) => {
      const user = users.find(u => (u as unknown as { email?: string }).email === email);
      if (user) return { ...user };
      return { uid: 'uid-test-email', email };
    }),
  };

  return auth;
}

export interface BackendState {
  firestore: FirestoreFake;
  auth: AuthFake;
  reset(): void;
  seed(col: string, id: string, data: Record<string, unknown>): void;
  getData(col: string, id: string): Record<string, unknown> | undefined;
  getCollection(col: string): Array<[string, Record<string, unknown>]>;
}

export const backend: BackendState = {
  firestore: createFirestoreFake(),
  auth: makeAuthFake(),
  reset() {
    // NO reemplazar el objeto firestore: los src/* capturan `const db = getDb()`
    // en module scope; el mock debe devolver SIEMPRE la misma instancia.
    backend.firestore.clear();
    backend.auth = makeAuthFake();
  },
  seed(col, id, data) {
    backend.firestore.seed(col, id, data);
  },
  getData(col, id) {
    return backend.firestore.getData(col, id);
  },
  getCollection(col) {
    return backend.firestore.getCollection(col);
  },
};

/**
 * Factory para vi.mock('../src/firebase').
 * Debe llamarse DENTRO de la factory del mock — referencia el singleton en runtime.
 */
export function mockFirebaseModule(): { getAdmin: () => unknown; db?: () => unknown; getDb?: () => unknown } {
  return {
    getAdmin: () => ({
      auth: () => backend.auth,
      firestore: () => backend.firestore.db,
    }),
    db: () => backend.firestore.db,
    getDb: () => backend.firestore.db,
  };
}