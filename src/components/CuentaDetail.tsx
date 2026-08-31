import React, { useState } from 'react';
import { Mail, Users, User, Calendar, Link, Search } from 'lucide-react';
import { asignarPerfil } from '../hooks/useCuentas';
import { useAuth } from '../contexts/AuthContext';
import useClientes from '../hooks/useClientes';
import toast from 'react-hot-toast';
import { useMoneda } from '../hooks/useMoneda';
import type { Cuenta } from '../types/cuenta';
import { ESTADO_BADGES } from '../constants';

interface CuentaDetailProps {
  cuenta: Cuenta;
}

const PERFIL_BADGES: Record<string, { label: string; class: string }> = {
  disponible: { label: 'Disponible', class: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40' },
  asignado: { label: 'Asignado', class: 'bg-amber-950/50 text-amber-400 border border-amber-800/40' },
};

export default function CuentaDetail({ cuenta }: CuentaDetailProps) {
  const { user } = useAuth();
  const { clientes: todosLosClientes, loading: loadingClientes } = useClientes(user);
  const { formatear } = useMoneda();

  const badge = ESTADO_BADGES[cuenta.estado] || { label: cuenta.estado, class: 'bg-slate-800 text-slate-300' };
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
    <div className="space-y-6 text-slate-100">
      {/* Estado y tipo */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
          cuenta.estado === 'disponible'
            ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
            : cuenta.estado === 'asignada'
              ? 'bg-indigo-950/50 text-indigo-300 border border-indigo-800/40'
              : 'bg-rose-950/50 text-rose-400 border border-rose-800/40'
        }`}>
          {badge.label}
        </span>
        <span className="px-3 py-1 rounded-full bg-indigo-950/50 text-cyan-300 border border-indigo-800/40 text-xs font-medium">
          {cuenta.tipoVenta === 'completa' ? 'Cuenta Completa' : 'Venta por Perfiles'}
        </span>
      </div>

      {/* Información principal */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide mb-1">Plataforma / Servicio</p>
          <p className="text-lg font-bold text-white">{cuenta.proveedor}</p>
          {cuenta.nombreProveedor && (
            <p className="text-xs text-indigo-400 mt-1 font-medium">Mayorista: {cuenta.nombreProveedor}</p>
          )}
        </div>
        <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide mb-1">Costo</p>
          <p className="text-lg font-bold text-white">{formatear(cuenta.costo)}</p>
        </div>
      </div>

      {/* Correo */}
      <div className="flex items-center gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
        <Mail size={20} className="text-indigo-400" />
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Correo de la cuenta</p>
          <p className="text-sm font-semibold text-slate-200 font-mono">{cuenta.correoCuenta}</p>
        </div>
      </div>

      {/* Período del Servicio */}
      {cuenta.fechaInicio && (
        <div className="flex items-center gap-3 p-4 bg-indigo-950/30 rounded-xl border border-indigo-800/40">
          <Calendar size={20} className="text-indigo-400" />
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide">Inicio</p>
              <p className="text-sm font-semibold text-white">{cuenta.fechaInicio}</p>
            </div>
            {cuenta.diasServicio && (
              <div>
                <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide">Duración</p>
                <p className="text-sm font-semibold text-white">{cuenta.diasServicio} días</p>
              </div>
            )}
            {cuenta.fechaVencimiento && (
              <div>
                <p className="text-xs font-medium text-indigo-400 uppercase tracking-wide">Vence</p>
                <p className={`text-sm font-semibold ${new Date(cuenta.fechaVencimiento) < new Date() ? 'text-rose-400' : 'text-white'}`}>
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
          <Users size={18} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Perfiles ({perfilesDisp}/{perfiles.length} disponibles)
          </h3>
        </div>
        {perfiles.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Sin perfiles</p>
        ) : (
          <div className="space-y-2">
            {perfiles.map((perfil, idx) => {
              const pBadge = PERFIL_BADGES[perfil.estado] || { label: perfil.estado, class: 'bg-slate-800 text-slate-300' };
              const estaAsignando = asignandoIdx === idx;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{perfil.nombre}</p>
                      {perfil.pin && (
                        <p className="text-xs text-slate-400">PIN: {perfil.pin}</p>
                      )}
                      {perfil.estado === 'asignado' && perfil.clienteNombre && (
                        <p className="text-xs text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                          <User size={12} />
                          {perfil.clienteNombre}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${pBadge.class}`}>
                      {pBadge.label}
                    </span>

                    {perfil.estado === 'disponible' && !estaAsignando && (
                      <button
                        onClick={() => {
                          setAsignandoIdx(idx);
                          setBusquedaCliente('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors text-xs font-semibold flex items-center gap-1 shadow-md shadow-indigo-950/50"
                        title="Asignar este perfil a un cliente"
                      >
                        <Link size={14} />
                        Asignar
                      </button>
                    )}

                    {estaAsignando && (
                      <div className="flex flex-col gap-2 w-full max-w-xs">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            value={busquedaCliente}
                            onChange={e => setBusquedaCliente(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
                        <div className="max-h-40 overflow-y-auto space-y-0.5 bg-slate-900 rounded-lg border border-slate-800 shadow-xl">
                          {loadingClientes ? (
                            <div className="p-2 text-xs text-slate-500 text-center">Cargando clientes...</div>
                          ) : clientesFiltrados.length === 0 ? (
                            <div className="p-2 text-xs text-slate-500 text-center">
                              {busquedaCliente ? 'Sin resultados' : 'Sin clientes'}
                            </div>
                          ) : (
                            clientesFiltrados.slice(0, 20).map(cliente => (
                              <button
                                key={cliente.id}
                                onClick={() => handleAsignar(idx, cliente.nombre)}
                                disabled={guardando}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-800 transition-colors text-xs disabled:opacity-50 text-slate-200"
                              >
                                <User size={12} className="text-slate-400 flex-shrink-0" />
                                <span className="font-medium text-slate-100 truncate">{cliente.nombre}</span>
                                {cliente.telefono && (
                                  <span className="text-slate-400 flex-shrink-0">{cliente.telefono}</span>
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
