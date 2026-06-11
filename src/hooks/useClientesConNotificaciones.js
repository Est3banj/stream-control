import { useState, useEffect } from 'react';
import useClientes from './useClientes';

/**
 * Hook personalizado para obtener clientes con notificaciones de vencimiento.
 * Usa el hook compartido useClientes para evitar listeners duplicados.
 * 
 * @param {Object} user - Usuario autenticado con uid, email y rol
 * @returns {Object} { clientes, notificaciones, loading, error }
 */
export default function useClientesConNotificaciones(user) {
  const { clientes, loading, error } = useClientes(user);
  const [notificaciones, setNotificaciones] = useState([]);

  useEffect(() => {
    if (loading) return;
    if (!clientes.length) {
      setNotificaciones([]);
      return;
    }

    // Notificaciones por vencimiento de servicio
    const notifsVencimiento = clientes
      .filter((c) => {
        if (c.diasRestantes === null) return false;
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
        diasRestantes: c.diasRestantes,
        fechaVencimiento: c.fechaVencimiento,
        propietarioId: c.propietarioId,
        usuarioEmail: c.usuarioEmail || '',
        tipo: 'vencimiento',
      }));

    // Notificaciones por saldo pendiente (en mora)
    const notifsMora = clientes
      .filter((c) => c.saldoPendiente > 0)
      .map((c) => ({
        id: `${c.id}_mora`,
        clienteId: c.id,
        nombreCliente: c.nombre,
        plataforma: c.plataforma || '',
        telefono: c.telefono || '',
        correo: c.correo || '',
        diasRestantes: c.diasRestantes,
        fechaVencimiento: c.fechaVencimiento,
        propietarioId: c.propietarioId,
        usuarioEmail: c.usuarioEmail || '',
        saldoPendiente: c.saldoPendiente,
        tipo: 'mora',
      }));

    const todas = [...notifsVencimiento, ...notifsMora].sort((a, b) => {
      // Primero mora, después vencidos, después próximos a vencer
      if (a.tipo === 'mora' && b.tipo !== 'mora') return -1;
      if (a.tipo !== 'mora' && b.tipo === 'mora') return 1;
      if (a.diasRestantes <= 0 && b.diasRestantes > 0) return -1;
      if (a.diasRestantes > 0 && b.diasRestantes <= 0) return 1;
      return (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999);
    });

    setNotificaciones(todas);
  }, [clientes, loading]);

  return { clientes, notificaciones, loading, error };
}
