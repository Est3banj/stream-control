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
import { parseDateToMs } from '../../utils/dateUtils';
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
  Trash2,
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cascadeTenantData, setCascadeTenantData] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const handleEliminarUsuario = async () => {
    if (!usuario?.id) return;
    setDeletingUser(true);
    try {
      const res = await callFunction<
        { uid: string; cascadeTenantData: boolean },
        { success: boolean; suscripcionesEliminadas?: number; recursosCascadaEliminados?: number }
      >('eliminarUsuarioAdmin', { uid: usuario.id, cascadeTenantData });

      if (res?.success) {
        toast.success(`Usuario ${usuario.nombre} eliminado definitivamente`);
        setShowDeleteModal(false);
        setCascadeTenantData(false);
        onClose();
        onUserUpdated?.();
      }
    } catch (error: any) {
      console.error('Error eliminando usuario:', error);
      toast.error(error.message || 'Error al eliminar el usuario');
    } finally {
      setDeletingUser(false);
    }
  };

  // Fetch telemetry on demand when drawer opens
  useEffect(() => {
    if (!isOpen || !usuario?.id) return;

    let mounted = true;
    setTelemetry((prev) => ({ ...prev, loading: true }));

    const fetchTelemetry = async () => {
      try {
        const tenantUid = usuario.id;

        // 1. Clientes (check both propietarioId and usuarioId)
        const clienteIds = new Set<string>();
        try {
          const snap1 = await getDocs(
            query(collection(db, 'clientes'), where('propietarioId', '==', tenantUid))
          );
          snap1.docs.forEach((d) => clienteIds.add(d.id));
        } catch {}
        try {
          const snap2 = await getDocs(
            query(collection(db, 'clientes'), where('usuarioId', '==', tenantUid))
          );
          snap2.docs.forEach((d) => clienteIds.add(d.id));
        } catch {}
        const totalClientes = clienteIds.size;

        // 2. Cuentas (check both propietarioId and usuarioId)
        const cuentaIds = new Set<string>();
        try {
          const snap1 = await getDocs(
            query(collection(db, 'cuentas'), where('propietarioId', '==', tenantUid))
          );
          snap1.docs.forEach((d) => cuentaIds.add(d.id));
        } catch {}
        try {
          const snap2 = await getDocs(
            query(collection(db, 'cuentas'), where('usuarioId', '==', tenantUid))
          );
          snap2.docs.forEach((d) => cuentaIds.add(d.id));
        } catch {}
        const totalCuentas = cuentaIds.size;

        // 3. Ventas (check both propietarioId and usuarioId)
        const ventasMap = new Map<string, any>();
        try {
          const snap1 = await getDocs(
            query(collection(db, 'ventas'), where('propietarioId', '==', tenantUid))
          );
          snap1.docs.forEach((d) => ventasMap.set(d.id, d.data()));
        } catch {}
        try {
          const snap2 = await getDocs(
            query(collection(db, 'ventas'), where('usuarioId', '==', tenantUid))
          );
          snap2.docs.forEach((d) => ventasMap.set(d.id, d.data()));
        } catch {}

        const totalVentas = ventasMap.size;
        let volumenVentas = 0;
        ventasMap.forEach((v) => {
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

      // Check current active subscription fechaFin or user activoHasta
      const subFinMs = parseDateToMs(suscripcionActiva?.fechaFin);
      const userFinMs = parseDateToMs(usuario.activoHasta);

      if (subFinMs && subFinMs > now.getTime()) {
        baseDate = new Date(subFinMs);
      } else if (userFinMs && userFinMs > now.getTime()) {
        baseDate = new Date(userFinMs);
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
    const phone = (usuario as any)?.telefono || (usuario as any)?.phone || '';
    const cleanPhone = sanitizarWhatsApp(phone);
    const msg = `👋 Hola ${usuario.nombre}, te contactamos desde el equipo de soporte de *StreamControl Pro*. ¿En qué podemos ayudarte con tu cuenta?`;
    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    }
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  // Calculate subscription remaining days and percentage (with fallback to usuario.activoHasta)
  const calculateSubscriptionProgress = () => {
    const startMs =
      parseDateToMs(suscripcionActiva?.fechaInicio) ||
      parseDateToMs(usuario.createdAt) ||
      (usuario.activoHasta ? (parseDateToMs(usuario.activoHasta)! - 30 * 24 * 60 * 60 * 1000) : null);

    const endMs =
      parseDateToMs(suscripcionActiva?.fechaFin) ||
      parseDateToMs(usuario.activoHasta);

    if (!endMs) {
      return { diasRestantes: 0, porcentaje: 0, totalDias: 30, hasData: false, startMs: null, endMs: null };
    }

    const effectiveStartMs = startMs || (endMs - 30 * 24 * 60 * 60 * 1000);
    const nowMs = Date.now();

    const totalDuration = Math.max(1, endMs - effectiveStartMs);
    const elapsed = Math.max(0, nowMs - effectiveStartMs);
    const diff = endMs - nowMs;
    const diasRestantes = Math.ceil(diff / (24 * 60 * 60 * 1000));
    const porcentaje = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

    return {
      diasRestantes,
      porcentaje,
      totalDias: Math.ceil(totalDuration / (24 * 60 * 60 * 1000)),
      hasData: true,
      startMs: effectiveStartMs,
      endMs,
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
              ) : subProgress.hasData ? (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    subProgress.diasRestantes > 0
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                      : 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                  }`}
                >
                  {subProgress.diasRestantes > 0 ? 'Activo' : 'Vencido'}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  Free
                </span>
              )}
            </div>

            {subProgress.hasData && (
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
                    {subProgress.startMs
                      ? new Date(subProgress.startMs).toLocaleDateString('es-CO')
                      : '—'}
                  </span>
                  <span>
                    Vence:{' '}
                    {subProgress.endMs
                      ? new Date(subProgress.endMs).toLocaleDateString('es-CO')
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

            {/* Zona de Peligro: Eliminación Definitiva */}
            <div className="pt-3 border-t border-rose-950/70 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider">
                <AlertTriangle size={14} className="text-rose-400" />
                <span>Zona de Peligro</span>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={Boolean(actionLoading)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-rose-950/50 hover:bg-rose-900/80 text-rose-300 border border-rose-700/60 shadow-lg shadow-rose-950/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Trash2 size={16} className="text-rose-400" />
                <span>Eliminar Usuario Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación de Eliminación Definitiva */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-in text-slate-100">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center">
                <Trash2 size={22} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">Eliminar Usuario Definitivamente</h3>
                <p className="text-xs text-rose-300">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
              <p>
                Estás por eliminar a <strong className="text-slate-100">{usuario.nombre}</strong> (<span className="text-cyan-300">{usuario.correo || usuario.email}</span>).
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Eliminará la cuenta de Firebase Auth.</li>
                <li>Eliminará el perfil de Firestore (<code className="text-indigo-300">usuarios/{usuario.id}</code>).</li>
                <li>Eliminará todas las suscripciones asociadas.</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl cursor-pointer hover:bg-rose-950/30 transition-colors">
              <input
                type="checkbox"
                checked={cascadeTenantData}
                onChange={(e) => setCascadeTenantData(e.target.checked)}
                className="mt-0.5 rounded border-rose-700 bg-slate-900 text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-900"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-semibold text-rose-200">
                  Eliminación en cascada de datos de negocio
                </span>
                <p className="text-rose-300/70 text-[11px]">
                  Elimina también clientes, cuentas, ventas, movimientos, vinculaciones y notificaciones de este tenant.
                </p>
              </div>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setCascadeTenantData(false);
                }}
                disabled={deletingUser}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminarUsuario}
                disabled={deletingUser}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 transition-all disabled:opacity-50"
              >
                {deletingUser ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirmar Eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
