/**
 * Singleton lazy de firebase-admin.
 * La inicialización ocurre UNA vez, leyendo FIREBASE_SERVICE_ACCOUNT (JSON) de env.
 * En tests se mockea este módulo (vi.mock('../src/firebase')).
 */

import admin from 'firebase-admin';
import { FIREBASE_SERVICE_ACCOUNT } from './config.js';

export function getAdmin(): typeof admin {
  if (!admin.apps.length) {
    const raw = FIREBASE_SERVICE_ACCOUNT();
    let parsed: admin.ServiceAccount;
    try {
      parsed = JSON.parse(raw) as admin.ServiceAccount;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT no es un JSON válido');
    }
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
  }
  return admin;
}

export function db(): admin.firestore.Firestore {
  return getAdmin().firestore();
}

export function getDb(): admin.firestore.Firestore {
  return db();
}