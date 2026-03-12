import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function ClientesActivos() {
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const activos = snapshot.docs
          .map(doc => {
            const c = { id: doc.id, ...doc.data() };
            const fechaVenc = new Date(c.fechaVencimiento);
            const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
            return { ...c, diasRestantes };
          })
          .filter(c => new Date(c.fechaVencimiento) > hoy);

        setClientes(activos);
      } catch (error) {
        console.error('Error procesando datos en tiempo real:', error);
      }
    }, (error) => {
      console.error('Error cargando clientes activos en tiempo real:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const enviarWhatsApp = (cliente) => {
    const mensaje = `Hola ${cliente.nombre}, tu servicio de ${cliente.plataforma} vence el ${cliente.fechaVencimiento}. ` +
                    `Te invitamos a renovarlo para seguir disfrutando sin interrupciones.`;
    const url = `https://wa.me/57${cliente.telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3 text-gray-900">Clientes Activos</h2>

      {clientes.length === 0 ? (
        <p className="text-gray-500 text-base">No hay clientes activos registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <ul className="text-gray-700 space-y-3 min-w-[320px]">
            {clientes.map(cliente => (
              <li
                key={cliente.id}
                className={`border-b border-gray-200 py-3 px-3 rounded-md flex flex-wrap justify-between items-center gap-2 
                ${cliente.diasRestantes <= 2 ? 'bg-yellow-100' : ''}`}
              >
                <div>
                  <p className="font-medium text-gray-800 text-lg">{cliente.nombre}</p>
                  <p className="text-sm sm:text-base text-gray-600">
                    {cliente.plataforma} — vence en {cliente.diasRestantes} día(s)
                  </p>
                </div>

                {cliente.diasRestantes <= 2 && (
                  <button
                    onClick={() => enviarWhatsApp(cliente)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm sm:text-base"
                  >
                    WhatsApp
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}