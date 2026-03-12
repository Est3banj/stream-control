import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function ClientesInactivos() {
  const [clientes, setClientes] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const hoy = new Date();
    let q;

    if (user.email === 'admin@streamcontrol.com') {
      q = collection(db, 'clientes');
    } else {
      q = query(collection(db, 'clientes'), where('propietarioId', '==', user.uid));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const inactivos = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(c => new Date(c.fechaVencimiento) <= hoy);

      setClientes(inactivos);
    }, (error) => {
      console.error('Error cargando clientes inactivos:', error);
    });

    return () => unsub();
  }, [user]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md w-full max-w-2xl mx-auto overflow-y-auto max-h-[70vh]">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 text-gray-900 text-center">Clientes Inactivos</h2>
      <ul className="text-gray-700 divide-y divide-gray-200">
        {clientes.length > 0 ? (
          clientes.map(cliente => (
            <li key={cliente.id} className="py-2 text-sm sm:text-base flex justify-between items-center">
              <span>{cliente.nombre}</span>
              <span className="text-gray-500 text-xs sm:text-sm">{cliente.plataforma}</span>
            </li>
          ))
        ) : (
          <p className="text-gray-500 text-sm">No hay clientes inactivos registrados.</p>
        )}
      </ul>
    </div>
  );
}