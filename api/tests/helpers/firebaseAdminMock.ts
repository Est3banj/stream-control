/**
 * Mock de firebase-admin para los tests: expone SOLO lo que consumen los ports
 * (admin.firestore.FieldValue y admin.firestore.Timestamp), con sentinels y
 * timestamps compatibles con el Firestore fake (detección por __op).
 *
 * Uso: vi.mock('firebase-admin', () => mockFirebaseAdmin());
 */

import { vi } from 'vitest';

export class FieldValueFake {
  static serverTimestamp(): unknown {
    return { __op: 'serverTimestamp' };
  }
  static increment(n: number): unknown {
    return { __op: 'increment', value: n };
  }
  static delete(): unknown {
    return { __op: 'delete' };
  }
}

export class TimestampFake {
  constructor(private readonly _ms: number) {}
  toMillis(): number {
    return this._ms;
  }
  toDate(): Date {
    return new Date(this._ms);
  }
  static now(): TimestampFake {
    return new TimestampFake(Date.now());
  }
  static fromDate(d: Date): TimestampFake {
    return new TimestampFake(d.getTime());
  }
}

export function mockFirebaseAdmin(): Record<string, unknown> {
  return {
    firestore: { FieldValue: FieldValueFake, Timestamp: TimestampFake },
    default: { firestore: { FieldValue: FieldValueFake, Timestamp: TimestampFake } },
    apps: [],
    initializeApp: vi.fn(() => ({})),
    credential: { cert: vi.fn() },
  };
}