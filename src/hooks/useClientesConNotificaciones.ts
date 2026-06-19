import { useState, useEffect } from 'react';
import useClientes from './useClientes';
import type { NotificacionDerivada } from '../types/hooks';
import type { Cliente } from '../types/cliente';

interface UseClientesConNotificacionesReturn {
  clientes: Cliente[];
  notificaciones: NotificacionDerivada[];
  loading: boolean;
  error: string | null;
}

export default function useClientesConNotificaciones(user: { uid?: string; rol?: string } | null): UseClientesConNotificacionesReturn {
  const { clientes, loading, error } = useClientes(user);
  const [notificaciones, setNotificaciones] = useState<NotificacionDerivada[]>([]);
  const isAdmin = user?.rol === 'admin';

  useEffect(() => {
    // El admin no necesita notificaciones de clientes individuales
    if (isAdmin) {
      setNotificaciones([]);
      return;
    }

    if (loading) return;
    if (!clientes.length) {
      setNotificaciones([]);
      return;
    }

    const notifsVencimiento: NotificacionDerivada[] = clientes
      .filter((c) => {
        if (c.diasRestantes === null || c.diasRestantes === undefined) return false;
        return (
          c.diasRestantes <= 0 ||
          c.diasRestantes === 1 ||
          c.diasRestantes === 3 ||
          c.diasRestantes === 5
        );
      })
      .map((c) => ({
        id: `${c.id}_vencimiento`,
        clienteId: c.id,
        nombreCliente: c.nombre,
        plataforma: c.plataforma || '',
        telefono: c.telefono || '',
        correo: c.correo || '',
        diasRestantes: c.diasRestantes ?? null,
        fechaVencimiento: c.fechaVencimiento,
        propietarioId: c.propietarioId,
        usuarioEmail: c.usuarioEmail || '',
        tipo: 'vencimiento' as const,
      }));

    const notifsMora: NotificacionDerivada[] = clientes
      .filter((c) => c.saldoPendiente > 0)
      .map((c) => ({
        id: `${c.id}_mora`,
        clienteId: c.id,
        nombreCliente: c.nombre,
        plataforma: c.plataforma || '',
        telefono: c.telefono || '',
        correo: c.correo || '',
        diasRestantes: c.diasRestantes ?? null,
        fechaVencimiento: c.fechaVencimiento,
        propietarioId: c.propietarioId,
        usuarioEmail: c.usuarioEmail || '',
        saldoPendiente: c.saldoPendiente,
        tipo: 'mora' as const,
      }));

    const todas = [...notifsVencimiento, ...notifsMora].sort((a, b) => {
      if (a.tipo === 'mora' && b.tipo !== 'mora') return -1;
      if (a.tipo !== 'mora' && b.tipo === 'mora') return 1;
      if ((a.diasRestantes ?? 0) <= 0 && (b.diasRestantes ?? 0) > 0) return -1;
      if ((a.diasRestantes ?? 0) > 0 && (b.diasRestantes ?? 0) <= 0) return 1;
      return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
    });

    setNotificaciones(todas);
  }, [clientes, loading, isAdmin]);

  return { clientes, notificaciones, loading, error };
}
