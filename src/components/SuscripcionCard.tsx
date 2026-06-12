import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, Calendar } from 'lucide-react';
import type { Suscripcion } from '../types/suscripcion';

interface SuscripcionCardProps {
  suscripcion: Suscripcion;
  onMarcarPagada?: (id: string) => void;
}

function formatDate(ts: Timestamp): string {
  return new Date(ts.seconds * 1000).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function estadoBadge(estado: string) {
  const styles: Record<string, string> = {
    activa: 'bg-green-100 text-green-700',
    expirada: 'bg-gray-100 text-gray-700',
    cancelada: 'bg-red-100 text-red-700',
  };
  const icons: Record<string, React.ReactNode> = {
    activa: <CheckCircle size={14} className="inline mr-1" />,
    expirada: <Clock size={14} className="inline mr-1" />,
    cancelada: <XCircle size={14} className="inline mr-1" />,
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[estado] || 'bg-gray-100 text-gray-700'}`}>
      {icons[estado]}
      {estado === 'activa' ? 'Activa' : estado === 'expirada' ? 'Expirada' : 'Cancelada'}
    </span>
  );
}

function pagoBadge(pagoEstado: string) {
  const styles: Record<string, string> = {
    pagado: 'bg-green-100 text-green-700',
    pendiente: 'bg-yellow-100 text-yellow-700',
    vencido: 'bg-red-100 text-red-700',
  };
  const icons: Record<string, React.ReactNode> = {
    pagado: <CheckCircle size={14} className="inline mr-1" />,
    pendiente: <AlertTriangle size={14} className="inline mr-1" />,
    vencido: <XCircle size={14} className="inline mr-1" />,
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[pagoEstado] || 'bg-gray-100 text-gray-700'}`}>
      {icons[pagoEstado]}
      {pagoEstado === 'pagado' ? 'Pagado' : pagoEstado === 'pendiente' ? 'Pendiente' : 'Vencido'}
    </span>
  );
}

export default function SuscripcionCard({ suscripcion, onMarcarPagada }: SuscripcionCardProps) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-lg">{suscripcion.planNombre}</h3>
            {estadoBadge(suscripcion.estado)}
          </div>

          <p className="text-sm text-gray-700 font-medium">
            Usuario: <span className="text-gray-900">{suscripcion.usuarioNombre}</span>
          </p>

          <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-indigo-400" />
              Inicio: {formatDate(suscripcion.fechaInicio)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-red-400" />
              Fin: {formatDate(suscripcion.fechaFin)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {pagoBadge(suscripcion.pagoEstado)}
            <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
              <DollarSign size={14} className="text-green-500" />
              ${suscripcion.monto.toLocaleString()}
            </span>
          </div>

          {suscripcion.notas && (
            <p className="text-xs text-gray-500 italic bg-white/50 rounded-lg p-2">
              {suscripcion.notas}
            </p>
          )}
        </div>

        {onMarcarPagada && suscripcion.pagoEstado !== 'pagado' && (
          <button
            onClick={() => onMarcarPagada(suscripcion.id)}
            className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
          >
            Marcar como pagada
          </button>
        )}
      </div>
    </div>
  );
}
