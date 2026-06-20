import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, addDoc, doc, updateDoc, getDocs, onSnapshot, serverTimestamp, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import type { UseSuscripcionesReturn } from '../types/hooks';
import type { Suscripcion, CreateSuscripcionInput, UpdateSuscripcionInput } from '../types/suscripcion';

let sharedUid: string | null = null;
let sharedIsAdmin = false;
let sharedData: Suscripcion[] = [];
let sharedLoading = true;
let sharedError: string | null = null;
let sharedUnsubscribe: (() => void) | null = null;
const subscribers = new Map<number, React.Dispatch<React.SetStateAction<Pick<UseSuscripcionesReturn, 'suscripciones' | 'loading' | 'error'>>>>();
let nextSubId = 0;

function broadcast() {
  subscribers.forEach((setState) => {
    setState({ suscripciones: sharedData, loading: sharedLoading, error: sharedError });
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
    ? collection(db, 'suscripciones')
    : query(collection(db, 'suscripciones'), where('usuarioId', '==', uid));

  sharedUnsubscribe = onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      sharedError = null;
      sharedData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Suscripcion[];
      sharedLoading = false;
      broadcast();
    },
    (error: Error) => {
      console.error('Error en listener de suscripciones:', error);
      sharedError = error.message || 'Error al cargar suscripciones';
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

export async function crearSuscripcion(data: CreateSuscripcionInput): Promise<string> {
  const duplicateQuery = query(
    collection(db, 'suscripciones'),
    where('usuarioId', '==', data.usuarioId),
    where('estado', '==', 'activa'),
  );
  const duplicateSnapshot = await getDocs(duplicateQuery);

  if (!duplicateSnapshot.empty) {
    throw new Error('El usuario ya tiene una suscripción activa');
  }

  const docRef = await addDoc(collection(db, 'suscripciones'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function actualizarSuscripcion(id: string, data: UpdateSuscripcionInput): Promise<void> {
  await updateDoc(doc(db, 'suscripciones', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function marcarPagada(id: string): Promise<void> {
  await updateDoc(doc(db, 'suscripciones', id), {
    pagoEstado: 'pagado',
    updatedAt: serverTimestamp(),
  });
}

export default function useSuscripciones(user: { uid?: string; rol?: string } | null): Pick<UseSuscripcionesReturn, 'suscripciones' | 'loading' | 'error'> {
  const [state, setState] = useState<Pick<UseSuscripcionesReturn, 'suscripciones' | 'loading' | 'error'>>(() => ({
    suscripciones: sharedData,
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
      setState({ suscripciones: [], loading: false, error: null });
      return;
    }

    subscribers.set(subId, setState);

    if (sharedUid === uid) {
      setState({ suscripciones: sharedData, loading: sharedLoading, error: sharedError });
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
