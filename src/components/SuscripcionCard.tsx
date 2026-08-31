import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { useMoneda } from '../hooks/useMoneda';
import { CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, Calendar } from 'lucide-react';
import type { Suscripcion } from '../types/suscripcion';

interface SuscripcionCardProps {
  suscripcion: Suscripcion;
  onMarcarPagada?: (id: string) => void;
  cargandoId?: string | null;
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
    activa: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40',
    expirada: 'bg-slate-800 text-slate-400 border border-slate-700',
    cancelada: 'bg-rose-950/50 text-rose-400 border border-rose-800/40',
  };
  const icons: Record<string, React.ReactNode> = {
    activa: <CheckCircle size={14} className="inline mr-1" />,
    expirada: <Clock size={14} className="inline mr-1" />,
    cancelada: <XCircle size={14} className="inline mr-1" />,
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[estado] || 'bg-slate-800 text-slate-400'}`}>
      {icons[estado]}
      {estado === 'activa' ? 'Activa' : estado === 'expirada' ? 'Expirada' : 'Cancelada'}
    </span>
  );
}

function pagoBadge(pagoEstado: string) {
  const styles: Record<string, string> = {
    pagado: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40',
    pendiente: 'bg-amber-950/50 text-amber-400 border border-amber-800/40',
    vencido: 'bg-rose-950/50 text-rose-400 border border-rose-800/40',
  };
  const icons: Record<string, React.ReactNode> = {
    pagado: <CheckCircle size={14} className="inline mr-1" />,
    pendiente: <AlertTriangle size={14} className="inline mr-1" />,
    vencido: <XCircle size={14} className="inline mr-1" />,
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[pagoEstado] || 'bg-slate-800 text-slate-400'}`}>
      {icons[pagoEstado]}
      {pagoEstado === 'pagado' ? 'Pagado' : pagoEstado === 'pendiente' ? 'Pendiente' : 'Vencido'}
    </span>
  );
}

export default function SuscripcionCard({ suscripcion, onMarcarPagada, cargandoId }: SuscripcionCardProps) {
  const { formatear } = useMoneda();
  return (
    <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white text-lg">{suscripcion.planNombre}</h3>
            {estadoBadge(suscripcion.estado)}
          </div>

          <p className="text-sm text-slate-300 font-medium">
            Usuario: <span className="text-white font-semibold">{suscripcion.usuarioNombre}</span>
          </p>

          <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-400" />
              Inicio: {formatDate(suscripcion.fechaInicio)}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-rose-400" />
              Fin: {formatDate(suscripcion.fechaFin)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {pagoBadge(suscripcion.pagoEstado)}
            <span className="flex items-center gap-1 text-sm font-semibold text-emerald-400">
              <DollarSign size={14} className="text-emerald-400" />
              {formatear(suscripcion.monto)}
            </span>
          </div>

          {suscripcion.notas && (
            <p className="text-xs text-slate-400 italic bg-slate-900 border border-slate-800 rounded-xl p-2.5">
              {suscripcion.notas}
            </p>
          )}
        </div>

        {onMarcarPagada && suscripcion.pagoEstado !== 'pagado' && (
          <button
            onClick={() => onMarcarPagada(suscripcion.id)}
            disabled={cargandoId === suscripcion.id}
            className="btn-primary text-sm py-2 px-4 whitespace-nowrap shadow-lg shadow-indigo-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cargandoId === suscripcion.id ? 'Procesando...' : 'Marcar como pagada'}
          </button>
        )}
      </div>
    </div>
  );
}
