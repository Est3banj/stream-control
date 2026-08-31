import React, { useEffect, useState } from 'react';
import { db, auth } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { callFunction } from '../../lib/apiClient';
import { useMoneda } from '../../hooks/useMoneda';
import { sanitizarWhatsApp } from '../../hooks/useAdminConfig';
import { actualizarSuscripcion } from '../../hooks/useSuscripciones';
import type { Usuario } from '../../types/usuario';
import type { Suscripcion } from '../../types/suscripcion';
import type { Plan } from '../../types/plan';
import {
  X,
  User,
  Mail,
  MailCheck,
  Shield,
  Calendar,
  CreditCard,
  Tv,
  Users,
  DollarSign,
  CalendarPlus,
  Send,
  MessageCircle,
  KeyRound,
  UserCheck,
  UserX,
  Package,
  Copy,
  Check,
  Activity,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UsuarioDrawerProps {
  usuario: Usuario | null;
  isOpen: boolean;
  onClose: () => void;
  suscripcionActiva?: Suscripcion;
  planes: Plan[];
  isVerificado?: boolean;
  onOpenChangePlan?: (usuario: Usuario) => void;
  onUserUpdated?: () => void;
}

interface TelemetryData {
  totalClientes: number;
  totalCuentas: number;
  totalVentas: number;
  volumenVentas: number;
  loading: boolean;
}

export default function UsuarioDrawer({
  usuario,
  isOpen,
  onClose,
  suscripcionActiva,
  planes,
  isVerificado,
  onOpenChangePlan,
  onUserUpdated,
}: UsuarioDrawerProps) {
  const { formatearDesdeBase } = useMoneda();
  const [copiedUid, setCopiedUid] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    totalClientes: 0,
    totalCuentas: 0,
    totalVentas: 0,
    volumenVentas: 0,
    loading: true,
  });

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch telemetry on demand when drawer opens
  useEffect(() => {
    if (!isOpen || !usuario?.id) return;

    let mounted = true;
    setTelemetry((prev) => ({ ...prev, loading: true }));

    const fetchTelemetry = async () => {
      try {
        const tenantUid = usuario.id;

        // 1. Clientes
        const clientesQ = query(
          collection(db, 'clientes'),
          where('usuarioId', '==', tenantUid)
        );
        const clientesSnap = await getDocs(clientesQ);
        const totalClientes = clientesSnap.size;

        // 2. Cuentas (check both usuarioId and propietarioId)
        let totalCuentas = 0;
        try {
          const cuentasQ = query(
            collection(db, 'cuentas'),
            where('usuarioId', '==', tenantUid)
          );
          const cuentasSnap = await getDocs(cuentasQ);
          totalCuentas = cuentasSnap.size;
        } catch {
          // fallback
        }

        // 3. Ventas
        const ventasQ = query(
          collection(db, 'ventas'),
          where('usuarioId', '==', tenantUid)
        );
        const ventasSnap = await getDocs(ventasQ);
        const totalVentas = ventasSnap.size;

        let volumenVentas = 0;
        ventasSnap.docs.forEach((d) => {
          const v = d.data();
          const precio = Number(v.precioVenta) || 0;
          const pantallas = Number(v.pantallas) || 1;
          volumenVentas += precio * pantallas;
        });

        if (mounted) {
          setTelemetry({
            totalClientes,
            totalCuentas,
            totalVentas,
            volumenVentas,
            loading: false,
          });
        }
      } catch (err) {
        console.error('Error cargando telemetría del usuario:', err);
        if (mounted) {
          setTelemetry({
            totalClientes: 0,
            totalCuentas: 0,
            totalVentas: 0,
            volumenVentas: 0,
            loading: false,
          });
        }
      }
    };

    fetchTelemetry();

    return () => {
      mounted = false;
    };
  }, [isOpen, usuario?.id]);

  if (!isOpen || !usuario) return null;

  const handleCopyUid = () => {
    navigator.clipboard.writeText(usuario.id);
    setCopiedUid(true);
    toast.success('UID copiado al portapapeles');
    setTimeout(() => setCopiedUid(false), 2000);
  };

  // Add Grace Days (+7, +15, +30)
  const handleExtenderGracia = async (dias: number) => {
    setActionLoading(`gracia-${dias}`);
    try {
      const now = new Date();
      let baseDate = now;

      // Check current active subscription fechaFin
      if (suscripcionActiva?.fechaFin?.seconds) {
        const subFin = new Date(suscripcionActiva.fechaFin.seconds * 1000);
        if (subFin > now) baseDate = subFin;
      } else if (usuario.activoHasta) {
        const userFin = usuario.activoHasta.toDate();
        if (userFin > now) baseDate = userFin;
      }

      const nuevaFechaFin = new Date(baseDate);
      nuevaFechaFin.setDate(nuevaFechaFin.getDate() + dias);
      const newTimestamp = Timestamp.fromDate(nuevaFechaFin);

      // Update usuario doc
      await updateDoc(doc(db, 'usuarios', usuario.id), {
        activoHasta: newTimestamp,
        estado: 'activo',
      });

      // Update active subscription if exists
      if (suscripcionActiva?.id) {
        await actualizarSuscripcion(suscripcionActiva.id, {
          fechaFin: newTimestamp,
          estado: 'activa',
        });
      }

      toast.success(`Acceso de ${usuario.nombre} extendido +${dias} días`);
      onUserUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error('Error al extender días de gracia');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle user active status
  const handleToggleEstado = async () => {
    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    setActionLoading('toggle-estado');
    try {
      await updateDoc(doc(db, 'usuarios', usuario.id), {
        estado: nuevoEstado,
      });
      toast.success(
        `Usuario ${nuevoEstado === 'activo' ? 'activado' : 'suspendido'} correctamente`
      );
      onUserUpdated?.();
    } catch (err) {
      console.error(err);
      toast.error('Error al cambiar estado del usuario');
    } finally {
      setActionLoading(null);
    }
  };

  // Send Password Reset Email
  const handleSendPasswordReset = async () => {
    if (!usuario.correo && !usuario.email) {
      toast.error('El usuario no tiene correo registrado');
      return;
    }
    const emailToUse = usuario.correo || usuario.email || '';
    setActionLoading('reset-pass');
    try {
      await sendPasswordResetEmail(auth, emailToUse);
      toast.success(`Email de restablecimiento enviado a ${emailToUse}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error al enviar email de restablecimiento');
    } finally {
      setActionLoading(null);
    }
  };

  // Send Verification Email
  const handleSendVerificationEmail = async () => {
    const emailToUse = usuario.correo || usuario.email;
    if (!emailToUse) {
      toast.error('El usuario no tiene correo registrado');
      return;
    }
    setActionLoading('verify-email');
    try {
      await callFunction('enviarCorreoVerificacion', {
        email: emailToUse,
        nombre: usuario.nombre,
      });
      toast.success('Email de verificación reenviado');
    } catch (err: any) {
      console.error(err);
      // Fallback
      toast.error(err?.message || 'No se pudo reenviar la verificación');
    } finally {
      setActionLoading(null);
    }
  };

  // WhatsApp Support message
  const getWhatsAppUrl = () => {
    const msg = `👋 Hola ${usuario.nombre}, te contactamos desde el equipo de soporte de *StreamControl Pro*. ¿En qué podemos ayudarte con tu cuenta?`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  // Calculate subscription remaining days and percentage
  const calculateSubscriptionProgress = () => {
    if (!suscripcionActiva?.fechaInicio?.seconds || !suscripcionActiva?.fechaFin?.seconds) {
      return { diasRestantes: 0, porcentaje: 0, totalDias: 30 };
    }
    const startMs = suscripcionActiva.fechaInicio.seconds * 1000;
    const endMs = suscripcionActiva.fechaFin.seconds * 1000;
    const nowMs = Date.now();

    const totalDuration = Math.max(1, endMs - startMs);
    const elapsed = Math.max(0, nowMs - startMs);
    const diff = endMs - nowMs;
    const diasRestantes = Math.ceil(diff / (24 * 60 * 60 * 1000));
    const porcentaje = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    return {
      diasRestantes,
      porcentaje,
      totalDias: Math.ceil(totalDuration / (24 * 60 * 60 * 1000)),
    };
  };

  const subProgress = calculateSubscriptionProgress();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm animate-fade-in flex justify-end">
      <div
        className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col text-slate-100 overflow-y-auto transform transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Drawer */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-950/60 sticky top-0 z-10 backdrop-blur-xl flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 border border-indigo-500/40 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-indigo-950/60 shrink-0">
              {usuario.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-white truncate">
                  {usuario.nombre}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    usuario.rol === 'admin'
                      ? 'bg-purple-950/60 text-purple-300 border-purple-800/50'
                      : 'bg-indigo-950/60 text-cyan-300 border-indigo-800/50'
                  }`}
                >
                  {usuario.rol === 'admin' ? 'Administrador' : 'Tenant'}
                </span>
              </div>

              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                {usuario.correo || usuario.email}
              </p>

              <div className="flex items-center gap-2 mt-2">
                {isVerificado ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <MailCheck size={14} />
                    <span>Email Verificado</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
                    <Mail size={14} />
                    <span>Email Sin Verificar</span>
                  </span>
                )}
                <span className="text-slate-600">•</span>
                <button
                  onClick={handleCopyUid}
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
                  title="Copiar UID"
                >
                  {copiedUid ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{usuario.id.substring(0, 8)}...</span>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Drawer */}
        <div className="p-6 space-y-6 flex-1">
          {/* Telemetría en Vivo (Bajo Demanda) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Activity size={16} className="text-cyan-400" />
                <span>Telemetría de Uso (En Vivo)</span>
              </div>
              {telemetry.loading && (
                <span className="text-xs text-slate-500 animate-pulse flex items-center gap-1">
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Consultando Firestore...</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Clientes */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-center">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-2">
                  <Users size={16} />
                </div>
                <p className="text-xs text-slate-400 font-medium">Clientes</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {telemetry.loading ? '...' : telemetry.totalClientes}
                </p>
              </div>

              {/* Cuentas */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-center">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto mb-2">
                  <Tv size={16} />
                </div>
                <p className="text-xs text-slate-400 font-medium">Cuentas</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {telemetry.loading ? '...' : telemetry.totalCuentas}
                </p>
              </div>

              {/* Volumen Ventas */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-center">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <DollarSign size={16} />
                </div>
                <p className="text-xs text-slate-400 font-medium">Volumen</p>
                <p className="text-sm font-bold text-emerald-400 mt-1 truncate">
                  {telemetry.loading ? '...' : formatearDesdeBase(telemetry.volumenVentas)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {telemetry.loading ? '' : `${telemetry.totalVentas} ventas`}
                </p>
              </div>
            </div>
          </div>

          {/* Tarjeta de Suscripción Vigente */}
          <div className="bg-gradient-to-br from-slate-950/90 to-indigo-950/30 border border-indigo-500/20 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-cyan-300 flex items-center justify-center">
                  <Package size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Suscripción Activa
                  </p>
                  <p className="text-base font-bold text-white">
                    {suscripcionActiva?.planNombre || usuario.plan || 'Starter (Sin Suscripción)'}
                  </p>
                </div>
              </div>

              {suscripcionActiva ? (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    suscripcionActiva.pagoEstado === 'pagado'
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                      : 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                  }`}
                >
                  {suscripcionActiva.pagoEstado === 'pagado' ? 'Pagado' : 'Pago Pendiente'}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  Free
                </span>
              )}
            </div>

            {suscripcionActiva && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Vigencia del ciclo:</span>
                  <span className="font-semibold text-cyan-300">
                    {subProgress.diasRestantes > 0
                      ? `${subProgress.diasRestantes} días restantes`
                      : 'Vencida / En gracia'}
                  </span>
                </div>

                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      subProgress.diasRestantes <= 3
                        ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                        : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                    }`}
                    style={{ width: `${Math.max(5, 100 - subProgress.porcentaje)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                  <span>
                    Inicio:{' '}
                    {suscripcionActiva.fechaInicio?.seconds
                      ? new Date(suscripcionActiva.fechaInicio.seconds * 1000).toLocaleDateString('es-CO')
                      : '—'}
                  </span>
                  <span>
                    Vence:{' '}
                    {suscripcionActiva.fechaFin?.seconds
                      ? new Date(suscripcionActiva.fechaFin.seconds * 1000).toLocaleDateString('es-CO')
                      : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Barra de Acciones de Soporte Rápido */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Acciones de Soporte Rápido
            </p>

            {/* Extensión de Días de Gracia */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <CalendarPlus size={16} className="text-indigo-400" />
                <span>Extender Días de Gracia / Vigencia</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleExtenderGracia(7)}
                  disabled={Boolean(actionLoading)}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-indigo-950/70 border border-slate-700/70 hover:border-indigo-500/50 text-xs font-semibold text-cyan-300 transition-all flex items-center justify-center gap-1"
                >
                  <span>+7 Días</span>
                </button>
                <button
                  onClick={() => handleExtenderGracia(15)}
                  disabled={Boolean(actionLoading)}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-indigo-950/70 border border-slate-700/70 hover:border-indigo-500/50 text-xs font-semibold text-cyan-300 transition-all flex items-center justify-center gap-1"
                >
                  <span>+15 Días</span>
                </button>
                <button
                  onClick={() => handleExtenderGracia(30)}
                  disabled={Boolean(actionLoading)}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-indigo-950/70 border border-slate-700/70 hover:border-indigo-500/50 text-xs font-semibold text-cyan-300 transition-all flex items-center justify-center gap-1"
                >
                  <span>+30 Días</span>
                </button>
              </div>
            </div>

            {/* Acciones de Cuenta y Seguridad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => onOpenChangePlan?.(usuario)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/40 text-cyan-300 text-xs font-semibold transition-all"
              >
                <Package size={16} />
                <span>Cambiar Plan</span>
              </button>

              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/40 text-emerald-300 text-xs font-semibold transition-all"
              >
                <MessageCircle size={16} />
                <span>Chatear WhatsApp</span>
              </a>

              <button
                onClick={handleSendPasswordReset}
                disabled={Boolean(actionLoading)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
              >
                <KeyRound size={16} className="text-amber-400" />
                <span>Reset Contraseña</span>
              </button>

              <button
                onClick={handleSendVerificationEmail}
                disabled={Boolean(actionLoading) || isVerificado}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  isVerificado
                    ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <Send size={16} className="text-cyan-400" />
                <span>Reenviar Verificación</span>
              </button>
            </div>

            {/* Toggle Activar / Suspender */}
            <div className="pt-2">
              <button
                onClick={handleToggleEstado}
                disabled={Boolean(actionLoading)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border transition-all ${
                  usuario.estado === 'activo'
                    ? 'bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border-rose-800/50'
                    : 'bg-emerald-950/40 hover:bg-emerald-950/80 text-emerald-300 border-emerald-800/50'
                }`}
              >
                {usuario.estado === 'activo' ? (
                  <>
                    <UserX size={16} />
                    <span>Suspender / Desactivar Cuenta</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={16} />
                    <span>Reactivar Cuenta de Usuario</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
