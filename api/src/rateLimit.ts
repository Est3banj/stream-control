/**
 * Rate-limit transaccional en Firestore (patrón AD-8/AD-4).
 * Colección `rate_limits/{scope}:{key}` con doc { count, windowStart }.
 * Transacción CORTA: get → check ventana → count >= max ? throw : count+1.
 * Rollover de ventana autoclimpiante (sin TTL nativo).
 */

import * as crypto from 'crypto';
import { APIError } from './errors.js';
import { db } from './firebase.js';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function checkAndIncrement(
  scope: string,
  key: string,
  max: number,
  windowMs: number,
  message: string,
): Promise<void> {
  const ref = db().collection('rate_limits').doc(`${scope}:${key}`);

  await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const now = Date.now();

    let count = 0;
    let windowStart = now;

    if (snap.exists) {
      const data = snap.data() as { count?: number; windowStart?: number };
      // Ventana vigente → conservar contador; ventana vencida → reiniciar (rollover)
      if (typeof data.windowStart === 'number' && now - data.windowStart < windowMs) {
        count = data.count ?? 0;
        windowStart = data.windowStart;
      }
    }

    if (count >= max) {
      throw new APIError('resource-exhausted', message);
    }

    transaction.set(ref, { count: count + 1, windowStart });
  });
}