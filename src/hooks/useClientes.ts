import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import type { UseClientesReturn } from '../types/hooks';
import type { Cliente } from '../types/cliente';

let sharedUid: string | null = null;
let sharedIsAdmin = false;
let sharedData: Cliente[] = [];
let sharedLoading = true;
let sharedError: string | null = null;
let sharedUnsubscribe: (() => void) | null = null;
const subscribers = new Map<number, React.Dispatch<React.SetStateAction<Pick<UseClientesReturn, 'clientes' | 'loading' | 'error'>>>>();
let nextSubId = 0;

function broadcast() {
  subscribers.forEach((setState) => {
    setState({ clientes: sharedData, loading: sharedLoading, error: sharedError });
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
    ? collection(db, 'clientes')
    : query(collection(db, 'clientes'), where('propietarioId', '==', uid));

  sharedUnsubscribe = onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      sharedError = null;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      sharedData = snapshot.docs.map((doc) => {
        const c = { id: doc.id, ...doc.data() } as Cliente;
        if (c.fechaVencimiento) {
          const venc = new Date(c.fechaVencimiento + 'T00:00:00');
          const diff = venc.getTime() - hoy.getTime();
          c.diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
        } else {
          c.diasRestantes = null;
        }
        return c;
      });

      sharedLoading = false;
      broadcast();
    },
    (error: Error) => {
      console.error('Error en listener de clientes:', error);
      sharedError = error.message || 'Error al cargar clientes';
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

export default function useClientes(user: { uid?: string; rol?: string } | null): Pick<UseClientesReturn, 'clientes' | 'loading' | 'error'> {
  const [state, setState] = useState<Pick<UseClientesReturn, 'clientes' | 'loading' | 'error'>>(() => ({
    clientes: sharedData,
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
      setState({ clientes: [], loading: false, error: null });
      return;
    }

    subscribers.set(subId, setState);

    if (sharedUid === uid) {
      setState({ clientes: sharedData, loading: sharedLoading, error: sharedError });
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
