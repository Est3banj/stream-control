import { useState, useEffect } from 'react';
import useClientes from './useClientes';

/**
 * Hook personalizado para obtener clientes con notificaciones de vencimiento.
 * Usa el hook compartido useClientes para evitar listeners duplicados.
 * 
 * @param {Object} user - Usuario autenticado con uid, email y rol
 * @returns {Object} { clientes, notificaciones, loading }
 */
export default function useClientesConNotificaciones(user) {
  const { clientes, loading } = useClientes(user);
  const [notificaciones, setNotificaciones] = useState([]);

  useEffect(() => {
    if (loading) return;
    if (!clientes.length) {
      setNotificaciones([]);
      return;
    }

    // Generar notificaciones para servicios urgentes
    // Criterios: vencidos (≤0), 1 día, 3 días, 5 días
    const notifs = clientes
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
        if (a.diasRestantes <= 0 && b.diasRestantes > 0) return -1;
        if (a.diasRestantes > 0 && b.diasRestantes <= 0) return 1;
        return a.diasRestantes - b.diasRestantes;
      });

    setNotificaciones(notifs);
  }, [clientes, loading]);

  return { clientes, notificaciones, loading };
}
