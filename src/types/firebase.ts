import type { Timestamp, FieldValue } from 'firebase/firestore';
export type { Timestamp, FieldValue };

export interface Vinculacion {
  uid: string;
  telegramChatId: string;
  telegramUsername: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CodigoVinculacion {
  uid: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  expirado: boolean;
}

export interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
}

export interface ImportMeta {
  readonly env: ImportMetaEnv;
}
