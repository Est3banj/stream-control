import React, { useState } from 'react';
import { Mail, Users, User, Calendar, Link, Search } from 'lucide-react';
import { asignarPerfil } from '../hooks/useCuentas';
import { useAuth } from '../contexts/AuthContext';
import useClientes from '../hooks/useClientes';
import toast from 'react-hot-toast';
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
  const { user } = useAuth();
  const { clientes: todosLosClientes, loading: loadingClientes } = useClientes(user);

  const badge = ESTADO_BADGES[cuenta.estado] || { label: cuenta.estado, class: 'bg-gray-100 text-gray-700' };
  const perfiles = Array.isArray(cuenta.perfiles) ? cuenta.perfiles : [];
  const perfilesDisp = perfiles.filter(p => p.estado === 'disponible').length;

  const [asignandoIdx, setAsignandoIdx] = useState<number | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleAsignar = async (idx: number, clienteNombre: string) => {
    if (!clienteNombre.trim() || !user) return;
    setGuardando(true);
    try {
      await asignarPerfil(cuenta.id, idx, clienteNombre.trim(), user.uid!);
      toast.success(`Perfil asignado a ${clienteNombre.trim()}`);
      setAsignandoIdx(null);
      setBusquedaCliente('');
    } catch (err) {
      console.error('Error asignando perfil:', err);
      toast.error('Error al asignar el perfil');
    } finally {
      setGuardando(false);
    }
  };

  const clientesFiltrados = todosLosClientes.filter(
    c => !busquedaCliente || c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())
  );

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
            Perfiles ({perfilesDisp}/{perfiles.length} disponibles)
          </h3>
        </div>
        {perfiles.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Sin perfiles</p>
        ) : (
          <div className="space-y-2">
            {perfiles.map((perfil, idx) => {
              const pBadge = PERFIL_BADGES[perfil.estado] || { label: perfil.estado, class: 'bg-gray-100 text-gray-700' };
              const estaAsignando = asignandoIdx === idx;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{perfil.nombre}</p>
                      {perfil.pin && (
                        <p className="text-xs text-gray-500">PIN: {perfil.pin}</p>
                      )}
                      {perfil.estado === 'asignado' && perfil.clienteNombre && (
                        <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                          <User size={12} />
                          {perfil.clienteNombre}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pBadge.class}`}>
                      {pBadge.label}
                    </span>

                    {perfil.estado === 'disponible' && !estaAsignando && (
                      <button
                        onClick={() => {
                          setAsignandoIdx(idx);
                          setBusquedaCliente('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors text-xs font-semibold flex items-center gap-1"
                        title="Asignar este perfil a un cliente"
                      >
                        <Link size={14} />
                        Asignar
                      </button>
                    )}

                    {estaAsignando && (
                      <div className="flex flex-col gap-2 w-full max-w-xs">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={busquedaCliente}
                            onChange={e => setBusquedaCliente(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                            autoFocus
                            disabled={guardando}
                            onKeyDown={e => {
                              if (e.key === 'Escape') {
                                setAsignandoIdx(null);
                                setBusquedaCliente('');
                              }
                            }}
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-0.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                          {loadingClientes ? (
                            <div className="p-2 text-xs text-gray-400 text-center">Cargando clientes...</div>
                          ) : clientesFiltrados.length === 0 ? (
                            <div className="p-2 text-xs text-gray-400 text-center">
                              {busquedaCliente ? 'Sin resultados' : 'Sin clientes'}
                            </div>
                          ) : (
                            clientesFiltrados.slice(0, 20).map(cliente => (
                              <button
                                key={cliente.id}
                                onClick={() => handleAsignar(idx, cliente.nombre)}
                                disabled={guardando}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-indigo-50 transition-colors text-xs disabled:opacity-50"
                              >
                                <User size={12} className="text-gray-400 flex-shrink-0" />
                                <span className="font-medium text-gray-900 truncate">{cliente.nombre}</span>
                                {cliente.telefono && (
                                  <span className="text-gray-400 flex-shrink-0">{cliente.telefono}</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
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
