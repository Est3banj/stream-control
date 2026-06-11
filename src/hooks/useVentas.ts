import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import type { UseVentasReturn } from '../types/hooks';
import type { Venta } from '../types/venta';

let sharedUid: string | null = null;
let sharedIsAdmin = false;
let sharedData: Venta[] = [];
let sharedLoading = true;
let sharedError: string | null = null;
let sharedUnsubscribe: (() => void) | null = null;
const subscribers = new Map<number, React.Dispatch<React.SetStateAction<Pick<UseVentasReturn, 'ventas' | 'loading' | 'error'>>>>();
let nextSubId = 0;

function broadcast() {
  subscribers.forEach((setState) => {
    setState({ ventas: sharedData, loading: sharedLoading, error: sharedError });
  });
}

function startListener(uid: string, isAdmin: boolean) {
  if (sharedUnsubscribe) {
    sharedUnsubscribe();
    sharedUnsubscribe = null;
  }

  sharedUid = uid;
  sharedIsAdmin = isAdmin;
  sharedLoading = true;
  broadcast();

  const q = isAdmin
    ? collection(db, 'ventas')
    : query(collection(db, 'ventas'), where('propietarioId', '==', uid));

  sharedUnsubscribe = onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      sharedError = null;
      sharedData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Venta[];
      sharedLoading = false;
      broadcast();
    },
    (error: Error) => {
      console.error('Error en listener de ventas:', error);
      sharedError = error.message || 'Error al cargar ventas';
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
  sharedUid = null;
  sharedData = [];
  sharedLoading = true;
}

export default function useVentas(user: { uid?: string; rol?: string } | null): Pick<UseVentasReturn, 'ventas' | 'loading' | 'error'> {
  const [state, setState] = useState<Pick<UseVentasReturn, 'ventas' | 'loading' | 'error'>>(() => ({
    ventas: sharedData,
    loading: sharedLoading,
    error: sharedError,
  }));

  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!idRef.current) idRef.current = ++nextSubId;
    const subId = idRef.current;
    const uid = user?.uid;
    const isAdmin = user?.rol === 'admin';

    if (!uid) {
      setState({ ventas: [], loading: false, error: null });
      return;
    }

    subscribers.set(subId, setState);

    if (sharedUid === uid) {
      setState({ ventas: sharedData, loading: sharedLoading, error: sharedError });
    }

    if (!sharedUnsubscribe || sharedUid !== uid) {
      startListener(uid, isAdmin);
    }

    return () => {
      subscribers.delete(subId);
      if (subscribers.size === 0) {
        stopListener();
      }
    };
  }, [user?.uid, user?.rol]);

  return state;
}
