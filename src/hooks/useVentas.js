import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

/**
 * Hook compartido para obtener ventas en tiempo real.
 * 
 * Usa listener singleton a nivel de módulo para que múltiples componentes
 * compartan la misma conexión a Firestore (aunque en la práctica Dashboard
 * y Reportes no se montan simultáneamente).
 * 
 * @param {Object} user - Usuario autenticado con uid y rol
 * @returns {{ ventas: Array, loading: boolean }}
 */

// ─── Estado singleton compartido ──────────────────────────────
let sharedUid = null;
let sharedIsAdmin = false;
let sharedData = [];
let sharedLoading = true;
let sharedUnsubscribe = null;
const subscribers = new Map();
let nextSubId = 0;

function broadcast() {
  subscribers.forEach((setState) => {
    setState({ ventas: sharedData, loading: sharedLoading });
  });
}

function startListener(uid, isAdmin) {
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
    (snapshot) => {
      sharedData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      sharedLoading = false;
      broadcast();
    },
    (error) => {
      console.error('Error en listener de ventas:', error);
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

export default function useVentas(user) {
  const [state, setState] = useState(() => ({
    ventas: sharedData,
    loading: sharedLoading,
  }));

  const idRef = useRef(null);

  useEffect(() => {
    if (!idRef.current) idRef.current = ++nextSubId;
    const subId = idRef.current;
    const uid = user?.uid;
    const isAdmin = user?.rol === 'admin';

    if (!uid) {
      setState({ ventas: [], loading: false });
      return;
    }

    subscribers.set(subId, setState);

    if (sharedUid === uid) {
      setState({ ventas: sharedData, loading: sharedLoading });
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
