import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

/**
 * Hook personalizado para obtener clientes con notificaciones de vencimiento
 * Calcula localmente los días restantes y genera notificaciones urgentes
 * 
 * @param {Object} user - Usuario autenticado con uid, email y rol
 * @returns {Object} { clientes, notificaciones, loading }
 */
export default function useClientesConNotificaciones(user) {
  const [clientes, setClientes] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setClientes([]);
      setNotificaciones([]);
      setLoading(false);
      return;
    }

    // Construir query según el rol del usuario
    let q;
    if (user.rol === 'admin' || user.email === 'admin@streamcontrol.com') {
      q = collection(db, 'clientes');
    } else {
      q = query(collection(db, 'clientes'), where('propietarioId', '==', user.uid));
    }

    // Suscripción en tiempo real
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Procesar clientes y calcular días restantes
        const clientesData = snapshot.docs.map((doc) => {
          const cliente = { id: doc.id, ...doc.data() };
          
          if (cliente.fechaVencimiento) {
            const fechaVenc = new Date(cliente.fechaVencimiento);
            fechaVenc.setHours(0, 0, 0, 0);
            const diffTime = fechaVenc - hoy;
            const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            cliente.diasRestantes = diasRestantes;
          } else {
            cliente.diasRestantes = null;
          }

          return cliente;
        });

        setClientes(clientesData);

        // Generar notificaciones para servicios urgentes
        // Criterios: vencidos (≤0), 1 día, 3 días, 5 días
        const notifs = clientesData
          .filter((c) => {
            if (c.diasRestantes === null) return false;
            // Incluir: vencidos, 1, 3, 5 días
            return (
              c.diasRestantes <= 0 ||
              c.diasRestantes === 1 ||
              c.diasRestantes === 3 ||
              c.diasRestantes === 5
            );
          })
          .map((c) => ({
            id: c.id,
            clienteId: c.id,
            nombreCliente: c.nombre,
            plataforma: c.plataforma || '',
            telefono: c.telefono || '',
            correo: c.correo || '',
            diasRestantes: c.diasRestantes,
            fechaVencimiento: c.fechaVencimiento,
            propietarioId: c.propietarioId,
            usuarioEmail: c.usuarioEmail || '',
          }))
          .sort((a, b) => {
            // Ordenar por urgencia: vencidos primero, luego por días restantes ascendente
            if (a.diasRestantes <= 0 && b.diasRestantes > 0) return -1;
            if (a.diasRestantes > 0 && b.diasRestantes <= 0) return 1;
            return a.diasRestantes - b.diasRestantes;
          });

        setNotificaciones(notifs);
        setLoading(false);
      },
      (error) => {
        console.error('Error cargando clientes:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { clientes, notificaciones, loading };
}
