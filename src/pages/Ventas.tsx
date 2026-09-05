import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import VentasForm from '../components/VentasForm';
import LoadingScreen from '../components/LoadingScreen';
import type { Cliente } from '../types/cliente';
import type { Venta } from '../types/venta';
import { PlayCircle } from 'lucide-react';
import { getTutorialById } from '../data/tutoriales';
import VideoTutorialModal from '../components/VideoTutorialModal';

export default function Ventas() {
  const { user } = useAuth();
  const location = useLocation();
  const [initialData, setInitialData] = useState<Record<string, unknown> | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [mostrarTutorial, setMostrarTutorial] = useState(false);
  const tutorialVentas = getTutorialById('registro-ventas');

  useEffect(() => {
    const cliente = (location.state as { cliente?: Cliente })?.cliente;
    if (!cliente) return;

    setLoading(true);

    const data: Record<string, unknown> = {
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      correo: cliente.correo || '',
      plataforma: cliente.plataforma,
      cuentaId: cliente.cuentaId || '',
      perfilNombre: cliente.perfilAsignado || '',
      perfil: cliente.perfilAsignado || '',
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
            data.perfil = cliente.perfilAsignado || lastVenta.perfilNombre || lastVenta.perfil || '';
            data.perfilNombre = cliente.perfilAsignado || lastVenta.perfilNombre || lastVenta.perfil || '';
            data.cuentaId = cliente.cuentaId || lastVenta.cuentaId || '';
            data.pinPerfil = lastVenta.perfilPin || lastVenta.pinPerfil || '';
            data.pantallas = lastVenta.pantallas || 1;
            data.precioVenta = lastVenta.precioVenta || 0;
            data.costoServicio = lastVenta.costoPorPerfil || lastVenta.costoServicio || 0;
            if (lastVenta.perfiles && lastVenta.perfiles.length > 0) {
              data.perfiles = lastVenta.perfiles;
            } else if (data.perfilNombre) {
              data.perfiles = [{ nombre: data.perfilNombre as string, pin: (data.pinPerfil as string) || '' }];
            }
          } else if (cliente.perfilAsignado) {
            data.perfiles = [{ nombre: cliente.perfilAsignado, pin: '' }];
          }
          setInitialData(data);
          setLoading(false);
        })
        .catch(() => {
          if (cliente.perfilAsignado && !data.perfiles) {
            data.perfiles = [{ nombre: cliente.perfilAsignado, pin: '' }];
          }
          setInitialData(data);
          setLoading(false);
        });
    } else {
      if (cliente.perfilAsignado && !data.perfiles) {
        data.perfiles = [{ nombre: cliente.perfilAsignado, pin: '' }];
      }
      setInitialData(data);
      setLoading(false);
    }
  }, [location.state, user]);

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Registrar Venta
          </h1>
          <p className="text-slate-400">
            {initialData
              ? 'Datos del cliente precargados — ajustá lo necesario'
              : 'Completa el formulario para registrar una nueva venta'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarTutorial(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-cyan-300 border border-indigo-500/30 transition-all hover:scale-[1.02] shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <PlayCircle size={15} className="text-cyan-400" />
          <span>Guía de Ventas</span>
        </button>
      </div>
      {loading ? (
        <LoadingScreen mensaje="Cargando datos..." />
      ) : (
        <VentasForm initialData={initialData} />
      )}

      {mostrarTutorial && tutorialVentas && (
        <VideoTutorialModal
          tutorial={tutorialVentas}
          onClose={() => setMostrarTutorial(false)}
        />
      )}
    </div>
  );
}
