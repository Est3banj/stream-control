import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import VentasForm from '../components/VentasForm';
import type { Cliente } from '../types/cliente';
import type { Venta } from '../types/venta';

export default function Ventas() {
  const { user } = useAuth();
  const location = useLocation();
  const [initialData, setInitialData] = useState<Record<string, unknown> | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cliente = (location.state as { cliente?: Cliente })?.cliente;
    if (!cliente) return;

    setLoading(true);

    const data: Record<string, unknown> = {
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      correo: cliente.correo || '',
      plataforma: cliente.plataforma,
    };

    if (user?.uid) {
      const q = query(
        collection(db, 'ventas'),
        where('nombre', '==', cliente.nombre),
        where('propietarioId', '==', user.uid),
        orderBy('fechaRegistro', 'desc'),
        limit(1)
      );

      getDocs(q)
        .then((snapshot) => {
          if (!snapshot.empty) {
            const lastVenta = snapshot.docs[0].data() as Venta;
            data.perfil = lastVenta.perfil || '';
            data.pinPerfil = lastVenta.pinPerfil || '';
            data.pantallas = lastVenta.pantallas || 1;
            data.precioVenta = lastVenta.precioVenta || 0;
            data.costoServicio = lastVenta.costoServicio || 0;
          }
          setInitialData(data);
          setLoading(false);
        })
        .catch(() => {
          setInitialData(data);
          setLoading(false);
        });
    } else {
      setInitialData(data);
      setLoading(false);
    }
  }, [location.state, user]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
          Registrar Venta
        </h1>
        <p className="text-gray-600">
          {initialData
            ? 'Datos del cliente precargados — ajustá lo necesario'
            : 'Completa el formulario para registrar una nueva venta'}
        </p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="ml-3 text-gray-600 font-medium">Cargando datos del cliente...</p>
        </div>
      ) : (
        <VentasForm initialData={initialData} />
      )}
    </div>
  );
}
