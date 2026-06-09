import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

/**
 * Hook compartido para obtener clientes en tiempo real.
 * 
 * Usa un listener singleton a nivel de módulo para que múltiples componentes
 * compartan la MISMA conexión a Firestore, evitando reads duplicados.
 * 
 * @param {Object} user - Usuario autenticado con uid y rol
 * @returns {{ clientes: Array, loading: boolean }}
 */

// ─── Estado singleton compartido ──────────────────────────────
// Todas las instancias del hook comparten este mismo listener.
let sharedUid = null;
let sharedIsAdmin = false;
let sharedData = [];
let sharedLoading = true;
let sharedUnsubscribe = null;
const subscribers = new Map();
let nextSubId = 0;

function broadcast() {
  subscribers.forEach((setState) => {
    setState({ clientes: sharedData, loading: sharedLoading });
  });
}

function startListener(uid, isAdmin) {
  // Limpiar listener anterior si el usuario cambió
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
    (snapshot) => {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      sharedData = snapshot.docs.map((doc) => {
        const c = { id: doc.id, ...doc.data() };
        if (c.fechaVencimiento) {
          const diff = new Date(c.fechaVencimiento) - hoy;
          c.diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
        } else {
          c.diasRestantes = null;
        }
        return c;
      });

      sharedLoading = false;
      broadcast();
    },
    (error) => {
      console.error('Error en listener de clientes:', error);
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

// ─── Hook ─────────────────────────────────────────────────────

export default function useClientes(user) {
  const [state, setState] = useState(() => ({
    clientes: sharedData,
    loading: sharedLoading,
  }));

  const idRef = useRef(null);

  useEffect(() => {
    if (!idRef.current) idRef.current = ++nextSubId;
    const subId = idRef.current;
    const uid = user?.uid;
    const isAdmin = user?.rol === 'admin';

    if (!uid) {
      setState({ clientes: [], loading: false });
      return;
    }

    // Registrar este componente como subscriptor
    subscribers.set(subId, setState);

    // Sincronizar con el estado actual
    if (sharedUid === uid) {
      setState({ clientes: sharedData, loading: sharedLoading });
    }

    // Iniciar listener si no hay uno activo o el usuario cambió
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
