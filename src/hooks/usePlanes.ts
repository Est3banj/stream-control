import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, onSnapshot, serverTimestamp, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import type { UsePlanesReturn } from '../types/hooks';
import type { Plan, PlanInput } from '../types/plan';

let sharedData: Plan[] = [];
let sharedLoading = true;
let sharedError: string | null = null;
let sharedUnsubscribe: (() => void) | null = null;
const subscribers = new Map<number, React.Dispatch<React.SetStateAction<Pick<UsePlanesReturn, 'planes' | 'loading' | 'error'>>>>();
let nextSubId = 0;

function broadcast() {
  subscribers.forEach((setState) => {
    setState({ planes: sharedData, loading: sharedLoading, error: sharedError });
  });
}

function startListener() {
  if (sharedUnsubscribe) {
    sharedUnsubscribe();
    sharedUnsubscribe = null;
  }

  sharedLoading = true;
  broadcast();

  sharedUnsubscribe = onSnapshot(
    collection(db, 'planes'),
    (snapshot: QuerySnapshot<DocumentData>) => {
      sharedError = null;
      sharedData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Plan[];
      sharedLoading = false;
      broadcast();
    },
    (error: Error) => {
      console.error('Error en listener de planes:', error);
      sharedError = error.message || 'Error al cargar planes';
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
  sharedData = [];
  sharedLoading = true;
}

export async function crearPlan(data: PlanInput): Promise<string> {
  const docRef = await addDoc(collection(db, 'planes'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function actualizarPlan(id: string, data: Partial<PlanInput>): Promise<void> {
  await updateDoc(doc(db, 'planes', id), data);
}

export async function togglePlanActive(id: string, current: boolean): Promise<void> {
  await updateDoc(doc(db, 'planes', id), { activo: !current });
}

export async function eliminarPlan(id: string): Promise<void> {
  const subsSnapshot = await getDocs(
    query(collection(db, 'suscripciones'), where('planId', '==', id), where('estado', '==', 'activa')),
  );

  if (!subsSnapshot.empty) {
    throw new Error('No se puede eliminar: el plan tiene suscripciones activas');
  }

  await deleteDoc(doc(db, 'planes', id));
}

export default function usePlanes(user: { uid?: string; rol?: string } | null): Pick<UsePlanesReturn, 'planes' | 'loading' | 'error'> {
  const [state, setState] = useState<Pick<UsePlanesReturn, 'planes' | 'loading' | 'error'>>(() => ({
    planes: sharedData,
    loading: sharedLoading,
    error: sharedError,
  }));

  const idRef = useRef<number | null>(null);

  useEffect(() => {
    if (!idRef.current) idRef.current = ++nextSubId;
    const subId = idRef.current;
    const uid = user?.uid;

    if (!uid) {
      setState({ planes: [], loading: false, error: null });
      return;
    }

    subscribers.set(subId, setState);
    setState({ planes: sharedData, loading: sharedLoading, error: sharedError });

    if (!sharedUnsubscribe) {
      startListener();
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
