import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Cuenta, CreateCuentaInput, UpdateCuentaInput } from '../types/cuenta';

let sharedUid: string | null = null;
let sharedIsAdmin = false;
let sharedData: Cuenta[] = [];
let sharedLoading = true;
let sharedError: string | null = null;
let sharedUnsubscribe: (() => void) | null = null;
const subscribers = new Map<number, React.Dispatch<React.SetStateAction<{ cuentas: Cuenta[]; loading: boolean; error: string | null }>>>();
let nextSubId = 0;

function broadcast() {
  subscribers.forEach((setState) => {
    setState({ cuentas: sharedData, loading: sharedLoading, error: sharedError });
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
    ? collection(db, 'cuentas')
    : query(collection(db, 'cuentas'), where('propietarioId', '==', uid));

  sharedUnsubscribe = onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      sharedError = null;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      sharedData = snapshot.docs.map((doc) => {
        const c = { id: doc.id, ...doc.data() } as Cuenta;
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
      console.error('Error en listener de cuentas:', error);
      sharedError = error.message || 'Error al cargar cuentas';
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

export async function crearCuenta(data: CreateCuentaInput, contrasena?: string): Promise<string> {
  const cuentaRef = await addDoc(collection(db, 'cuentas'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Guardar credenciales via Cloud Function (solo Admin SDK escribe en cuentas_secretos)
  if (contrasena) {
    try {
      const functions = getFunctions();
      const guardar = httpsCallable(functions, 'guardarCredenciales');
      await guardar({
        cuentaId: cuentaRef.id,
        correo: data.correoCuenta,
        contrasena,
      });
    } catch (err) {
      // Si la CF no está deployada aún, no fallamos la creación
      // El usuario puede configurar las credenciales después desde el panel
      console.warn('No se pudieron guardar las credenciales (CF no deployada?):', err);
    }
  }

  return cuentaRef.id;
}

export async function actualizarCuenta(id: string, data: UpdateCuentaInput): Promise<void> {
  await updateDoc(doc(db, 'cuentas', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleCuentaActiva(id: string, current: boolean): Promise<void> {
  await updateDoc(doc(db, 'cuentas', id), {
    estado: current ? 'disponible' : 'expirada',
    updatedAt: serverTimestamp(),
  });
}

export default function useCuentas(user: { uid?: string; rol?: string } | null): { cuentas: Cuenta[]; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ cuentas: Cuenta[]; loading: boolean; error: string | null }>(() => ({
    cuentas: sharedData,
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
      setState({ cuentas: [], loading: false, error: null });
      return;
    }

    subscribers.set(subId, setState);

    if (sharedUid === uid) {
      setState({ cuentas: sharedData, loading: sharedLoading, error: sharedError });
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
