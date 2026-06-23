import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { TokenCliente, CreateTokenInput } from '../types/token';

let sharedVendedorId: string | null = null;
let sharedData: TokenCliente[] = [];
let sharedLoading = true;
let sharedError: string | null = null;
let sharedUnsubscribe: (() => void) | null = null;
const subscribers = new Map<number, React.Dispatch<React.SetStateAction<{ tokens: TokenCliente[]; loading: boolean; error: string | null }>>>();
let nextSubId = 0;

function broadcast() {
  subscribers.forEach((setState) => {
    setState({ tokens: sharedData, loading: sharedLoading, error: sharedError });
  });
}

function startListener(vendedorId: string) {
  if (sharedUnsubscribe) {
    sharedUnsubscribe();
    sharedUnsubscribe = null;
  }

  sharedVendedorId = vendedorId;
  sharedLoading = true;
  broadcast();

  const q = query(collection(db, 'tokens'), where('vendedorId', '==', vendedorId));

  sharedUnsubscribe = onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      sharedError = null;
      sharedData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TokenCliente[];
      sharedLoading = false;
      broadcast();
    },
    (error: Error) => {
      console.error('Error en listener de tokens:', error);
      sharedError = error.message || 'Error al cargar tokens';
      sharedLoading = false;
      broadcast();
    },
  );
}

function stopListener() {
  if (sharedUnsubscribe) {
    sharedUnsubscribe();
    sharedUnsubscribe = null;
  }
  sharedVendedorId = null;
  sharedData = [];
  sharedLoading = true;
}

export async function generarToken(data: CreateTokenInput): Promise<string> {
  const functions = getFunctions();
  const fn = httpsCallable<
    { cuentaId: string; perfilNombre: string; clienteId: string; clienteNombre: string; expiraEn?: string },
    { token: string; url: string }
  >(functions, 'generarToken');

  const result = await fn({
    cuentaId: data.cuentaId,
    perfilNombre: data.perfilNombre,
    clienteId: data.clienteId,
    clienteNombre: data.clienteNombre,
    expiraEn: data.expiraEn,
  });

  return result.data.token;
}

export async function revocarToken(id: string): Promise<void> {
  const functions = getFunctions();
  const fn = httpsCallable<{ tokenId: string; activo: boolean }, { success: boolean }>(functions, 'toggleToken');
  await fn({ tokenId: id, activo: false });
}

export async function reactivarToken(id: string): Promise<void> {
  const functions = getFunctions();
  const fn = httpsCallable<{ tokenId: string; activo: boolean }, { success: boolean }>(functions, 'toggleToken');
  await fn({ tokenId: id, activo: true });
}

export default function useTokens(user: { uid?: string; rol?: string } | null): { tokens: TokenCliente[]; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ tokens: TokenCliente[]; loading: boolean; error: string | null }>(() => ({
    tokens: sharedData,
    loading: sharedLoading,
    error: sharedError,
  }));

  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!idRef.current) idRef.current = ++nextSubId;
    const subId = idRef.current;
    const uid = user?.uid;

    if (!uid) {
      setState({ tokens: [], loading: false, error: null });
      return;
    }

    subscribers.set(subId, setState);

    if (sharedVendedorId === uid) {
      setState({ tokens: sharedData, loading: sharedLoading, error: sharedError });
    }

    if (!sharedUnsubscribe || sharedVendedorId !== uid) {
      startListener(uid);
    }

    return () => {
      subscribers.delete(subId);
      if (subscribers.size === 0) {
        stopListener();
      }
    };
  }, [user?.uid]);

  return state;
}
