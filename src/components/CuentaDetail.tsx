import React from 'react';
import { Mail, DollarSign, Users, CheckCircle, XCircle, User, Calendar } from 'lucide-react';
import type { Cuenta } from '../types/cuenta';

interface CuentaDetailProps {
  cuenta: Cuenta;
}

const ESTADO_BADGES: Record<string, { label: string; class: string }> = {
  disponible: { label: 'Disponible', class: 'bg-green-100 text-green-700' },
  asignada: { label: 'Asignada', class: 'bg-blue-100 text-blue-700' },
  expirada: { label: 'Expirada', class: 'bg-red-100 text-red-700' },
};

const PERFIL_BADGES: Record<string, { label: string; class: string }> = {
  disponible: { label: 'Disponible', class: 'bg-green-100 text-green-700' },
  asignado: { label: 'Asignado', class: 'bg-amber-100 text-amber-700' },
};

export default function CuentaDetail({ cuenta }: CuentaDetailProps) {
  const badge = ESTADO_BADGES[cuenta.estado] || { label: cuenta.estado, class: 'bg-gray-100 text-gray-700' };
  const perfilesDisp = cuenta.perfiles.filter(p => p.estado === 'disponible').length;

  return (
    <div className="space-y-6">
      {/* Estado y tipo */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.class}`}>
          {badge.label}
        </span>
        <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
          {cuenta.tipoVenta === 'completa' ? 'Cuenta Completa' : 'Venta por Perfiles'}
        </span>
      </div>

      {/* Información principal */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl border border-indigo-100">
          <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">Proveedor</p>
          <p className="text-lg font-bold text-gray-900">{cuenta.proveedor}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl border border-indigo-100">
          <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">Costo</p>
          <p className="text-lg font-bold text-gray-900">${cuenta.costo.toLocaleString()}</p>
        </div>
      </div>

      {/* Correo */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <Mail size={20} className="text-gray-400" />
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Correo de la cuenta</p>
          <p className="text-sm font-semibold text-gray-900">{cuenta.correoCuenta}</p>
        </div>
      </div>

      {/* Período del Servicio */}
      {cuenta.fechaInicio && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <Calendar size={20} className="text-indigo-400" />
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Inicio</p>
              <p className="text-sm font-semibold text-gray-900">{cuenta.fechaInicio}</p>
            </div>
            {cuenta.diasServicio && (
              <div>
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Duración</p>
                <p className="text-sm font-semibold text-gray-900">{cuenta.diasServicio} días</p>
              </div>
            )}
            {cuenta.fechaVencimiento && (
              <div>
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Vence</p>
                <p className={`text-sm font-semibold ${new Date(cuenta.fechaVencimiento) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                  {cuenta.fechaVencimiento}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Perfiles */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Perfiles ({perfilesDisp}/{cuenta.perfiles.length} disponibles)
          </h3>
        </div>
        {cuenta.perfiles.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Sin perfiles (cuenta completa)</p>
        ) : (
          <div className="space-y-2">
            {cuenta.perfiles.map((perfil, idx) => {
              const pBadge = PERFIL_BADGES[perfil.estado] || { label: perfil.estado, class: 'bg-gray-100 text-gray-700' };
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User size={16} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{perfil.nombre}</p>
                      {perfil.pin && (
                        <p className="text-xs text-gray-500">PIN: {perfil.pin}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pBadge.class}`}>
                      {pBadge.label}
                    </span>
                    {perfil.estado === 'asignado' && perfil.clienteNombre && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <User size={12} />
                        {perfil.clienteNombre}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
