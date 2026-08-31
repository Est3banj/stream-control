import React, { useEffect, useState, useMemo } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as signOutAuth,
} from 'firebase/auth';
import { callFunction } from '../lib/apiClient';
import { auth, db, secondaryAuth } from '../firebase';
import { useMoneda } from '../hooks/useMoneda';
import { useAuth } from '../contexts/AuthContext';
import useSuscripciones, {
  crearSuscripcion,
  actualizarSuscripcion,
} from '../hooks/useSuscripciones';
import usePlanes from '../hooks/usePlanes';
import { formatDate } from '../utils/dateUtils';
import type { Usuario } from '../types/usuario';
import type { Suscripcion } from '../types/suscripcion';
import UsuarioDrawer from '../components/Admin/UsuarioDrawer';
import Paginador from '../components/Paginador';
import {
  UserPlus,
  Users,
  Shield,
  UserCheck,
  UserX,
  Mail,
  MailCheck,
  Eye,
  EyeOff,
  Package,
  X,
  Search,
  SlidersHorizontal,
  Activity,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  Database,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface UsuarioFormState {
  nombre: string;
  correo: string;
  password: string;
  rol: 'admin' | 'usuario';
  estado: 'activo' | 'inactivo';
  activoHasta: string;
}

interface OrphanUser {
  uid: string;
  email: string;
  nombre: string;
  rol?: string;
}

interface SyncAuthResult {
  success: boolean;
  totalAuth: number;
  totalFirestore: number;
  huerfanosFirestore: OrphanUser[];
  huerfanosAuth: OrphanUser[];
  purgados?: {
    usuariosFirestore: number;
    suscripciones: number;
  };
}

export default function Usuarios() {
  const { user } = useAuth();
  const { suscripciones } = useSuscripciones(user);
  const { planes } = usePlanes(user);
  const { formatearDesdeBase } = useMoneda();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [verificados, setVerificados] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCreateSection, setShowCreateSection] = useState(false);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [verificadoFilter, setVerificadoFilter] = useState<'todos' | 'verificado' | 'pendiente'>('todos');
  const [rolFilter, setRolFilter] = useState<'todos' | 'usuario' | 'admin'>('todos');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Drawer state
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<Usuario | null>(null);

  // Plan modal state
  const [planModal, setPlanModal] = useState<{
    usuarioId: string;
    usuarioNombre: string;
    suscripcionId: string | null;
    planActual: string;
  } | null>(null);
  const [nuevoPlanId, setNuevoPlanId] = useState('');
  const [guardandoPlan, setGuardandoPlan] = useState(false);

  // Sync with Auth modal state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncAuthResult | null>(null);
  const [activeSyncTab, setActiveSyncTab] = useState<'firestore' | 'auth'>('firestore');

  const [form, setForm] = useState<UsuarioFormState>({
    nombre: '',
    correo: '',
    password: '',
    rol: 'usuario',
    estado: 'activo',
    activoHasta: '',
  });

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Listen to Firestore usuarios
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'usuarios'),
      (snapshot: QuerySnapshot<DocumentData>) => {
        setUsuarios(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Usuario)));
      },
      (error: Error) => {
        console.error('Error cargando usuarios:', error);
        toast.error('Error al cargar usuarios');
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch verified emails from API
  useEffect(() => {
    (async () => {
      try {
        const data = await callFunction<
          Record<string, never>,
          { verificados: Record<string, boolean> }
        >('listarVerificados');
        setVerificados(data.verificados || {});
      } catch {
        // Ignore if API endpoint not available in test
      }
    })();
  }, []);

  /** Obtiene la suscripción activa de un usuario */
  const getSuscripcionActiva = (uid: string): Suscripcion | undefined =>
    suscripciones.find((s) => s.usuarioId === uid && s.estado === 'activa');

  // Multi-Filter & Search Logic
  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((u) => {
      // 1. Search text
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesNombre = (u.nombre || '').toLowerCase().includes(term);
        const matchesCorreo = (u.correo || u.email || '').toLowerCase().includes(term);
        const matchesUid = (u.id || '').toLowerCase().includes(term);
        if (!matchesNombre && !matchesCorreo && !matchesUid) return false;
      }

      // 2. Rol filter
      if (rolFilter !== 'todos' && u.rol !== rolFilter) return false;

      // 3. Estado filter
      if (estadoFilter !== 'todos' && u.estado !== estadoFilter) return false;

      // 4. Verificado filter
      if (verificadoFilter !== 'todos') {
        const isVerif = Boolean(verificados[u.id] || u.emailVerified || u.verificadoEn);
        if (verificadoFilter === 'verificado' && !isVerif) return false;
        if (verificadoFilter === 'pendiente' && isVerif) return false;
      }

      // 5. Plan filter
      if (planFilter !== 'todos') {
        const sub = getSuscripcionActiva(u.id);
        const planName = (sub?.planNombre || u.plan || '').toLowerCase();
        if (planFilter === 'sin_plan') {
          if (sub) return false;
        } else {
          if (!planName.includes(planFilter.toLowerCase())) return false;
        }
      }

      return true;
    });
  }, [usuarios, searchTerm, rolFilter, estadoFilter, verificadoFilter, planFilter, verificados, suscripciones]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rolFilter, estadoFilter, verificadoFilter, planFilter]);

  // Paginated slice
  const paginatedUsuarios = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsuarios.slice(start, start + itemsPerPage);
  }, [filteredUsuarios, currentPage, itemsPerPage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value } as UsuarioFormState);
  };

  const generarPasswordTemporal = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return `Tmp-${Array.from(array, (byte) => chars[byte % chars.length]).join('')}A!`;
  };

  const handleCrearUsuario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.nombre || !form.correo) {
      toast.error('Nombre y correo son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const passwordToUse = form.password?.trim() ? form.password : generarPasswordTemporal();

      const userCred = await createUserWithEmailAndPassword(
        secondaryAuth,
        form.correo,
        passwordToUse
      );

      const profile = {
        nombre: form.nombre,
        correo: form.correo,
        rol: form.rol || 'usuario',
        estado: form.estado || 'activo',
        activoHasta: form.activoHasta ? Timestamp.fromDate(new Date(form.activoHasta)) : null,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'usuarios', userCred.user.uid), profile);

      if (!form.password?.trim()) {
        try {
          await sendPasswordResetEmail(secondaryAuth, form.correo);
        } catch (err: unknown) {
          console.warn('No se pudo enviar email de restablecimiento:', err);
        }
      }

      try {
        await signOutAuth(secondaryAuth);
      } catch (e: unknown) {
        console.warn('No se pudo cerrar secondaryAuth:', e);
      }

      toast.success('Usuario creado correctamente.');
      setForm({
        nombre: '',
        correo: '',
        password: '',
        rol: 'usuario',
        estado: 'activo',
        activoHasta: '',
      });
      setShowCreateSection(false);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error('Error creando usuario:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Ese correo ya existe en Authentication.');
      } else {
        toast.error('Error al crear usuario. Revisa la consola.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleEstado = async (uid: string, estadoActual: string) => {
    setTogglingId(uid);
    try {
      const ref = doc(db, 'usuarios', uid);
      await updateDoc(ref, { estado: estadoActual === 'activo' ? 'inactivo' : 'activo' });
      toast.success(`Usuario ${estadoActual === 'activo' ? 'desactivado' : 'activado'} correctamente`);
    } catch (err: unknown) {
      console.error(err);
      toast.error('No se pudo actualizar el estado');
    } finally {
      setTogglingId(null);
    }
  };

  const abrirCambiarPlan = (u: Usuario) => {
    const susc = getSuscripcionActiva(u.id);
    setPlanModal({
      usuarioId: u.id,
      usuarioNombre: u.nombre,
      suscripcionId: susc?.id ?? null,
      planActual: susc?.planNombre ?? 'Starter (sin suscripción)',
    });
    setNuevoPlanId('');
  };

  const handleCambiarPlan = async () => {
    if (!planModal || !nuevoPlanId) {
      toast.error('Seleccioná un plan');
      return;
    }

    const plan = planes.find((p) => p.id === nuevoPlanId);
    if (!plan) {
      toast.error('Plan no encontrado');
      return;
    }

    setGuardandoPlan(true);
    try {
      if (planModal.suscripcionId) {
        await actualizarSuscripcion(planModal.suscripcionId, {
          planId: plan.id,
          planNombre: plan.nombre,
        });
        toast.success(`Plan de ${planModal.usuarioNombre} cambiado a ${plan.nombre}`);
      } else {
        const hoy = new Date();
        const fechaFin = new Date(hoy);
        fechaFin.setDate(fechaFin.getDate() + plan.duracionDias);

        await crearSuscripcion({
          usuarioId: planModal.usuarioId,
          usuarioNombre: planModal.usuarioNombre,
          planId: plan.id,
          planNombre: plan.nombre,
          fechaInicio: Timestamp.fromDate(hoy),
          fechaFin: Timestamp.fromDate(fechaFin),
          estado: 'activa',
          pagoEstado: 'pendiente',
          monto: plan.precio,
        });
        toast.success(`Suscripción creada para ${planModal.usuarioNombre} — ${plan.nombre}`);
      }
      setPlanModal(null);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error cambiando plan:', error);
      toast.error(error.message || 'Error al cambiar el plan');
    } finally {
      setGuardandoPlan(false);
    }
  };

  const abrirModalSincronizar = async () => {
    setShowSyncModal(true);
    setSyncLoading(true);
    try {
      const data = await callFunction<{ accion: string }, SyncAuthResult>(
        'sincronizarUsuariosAuth',
        { accion: 'auditar' }
      );
      setSyncResult(data);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error auditando sincronización:', error);
      toast.error(error.message || 'Error al auditar usuarios con Firebase Auth');
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePurgarHuerfanos = async () => {
    if (!syncResult || syncResult.huerfanosFirestore.length === 0) return;
    setPurging(true);
    try {
      const data = await callFunction<{ accion: string }, SyncAuthResult>(
        'sincronizarUsuariosAuth',
        { accion: 'purgar_huerfanos' }
      );
      toast.success(
        `Purga completada: ${data.purgados?.usuariosFirestore ?? 0} usuarios huérfanos y ${data.purgados?.suscripciones ?? 0} suscripciones eliminadas`
      );
      setSyncResult(data);
      try {
        const verifData = await callFunction<
          Record<string, never>,
          { verificados: Record<string, boolean> }
        >('listarVerificados');
        setVerificados(verifData.verificados || {});
      } catch {}
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error purgando huérfanos:', error);
      toast.error(error.message || 'Error al purgar usuarios huérfanos');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header & CRM Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-cyan-400">
              <Users size={22} />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                Directorio & CRM Tenants
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Control de cuentas, telemetría 360°, ciclo de vida de suscripciones y soporte
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={abrirModalSincronizar}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 border border-slate-700/80 text-xs sm:text-sm font-semibold shadow-lg shadow-cyan-950/30 transition-all hover:scale-105 active:scale-95"
          >
            <RefreshCw size={15} className={syncLoading ? 'animate-spin' : ''} />
            <span>Sincronizar con Auth</span>
          </button>

          <button
            onClick={() => setShowCreateSection(!showCreateSection)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-950/50 transition-all hover:scale-105 active:scale-95"
          >
            <UserPlus size={18} />
            <span>{showCreateSection ? 'Cerrar Formulario' : 'Nuevo Usuario'}</span>
          </button>
        </div>
      </div>

      {/* Formulario de creación (Collapsible) */}
      {showCreateSection && (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl shadow-2xl backdrop-blur-xl p-6 animate-scale-in">
          <div className="flex items-center justify-between gap-2 mb-6 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <UserPlus className="text-cyan-400" size={22} />
              <h2 className="text-lg font-bold text-white">Alta de Nuevo Tenant / Administrador</h2>
            </div>
            <button
              onClick={() => setShowCreateSection(false)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleCrearUsuario} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Nombre Completo *
                </label>
                <input
                  name="nombre"
                  placeholder="Ej: Carlos Gómez"
                  value={form.nombre}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                  <input
                    name="correo"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={form.correo}
                    onChange={handleChange}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Contraseña Inicial
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Opcional (se generará automática)"
                    value={form.password}
                    onChange={handleChange}
                    className="w-full h-11 pl-4 pr-10 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Rol de Cuenta
                </label>
                <select
                  name="rol"
                  value={form.rol}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-sm text-slate-100 cursor-pointer"
                >
                  <option value="usuario">Usuario (Tenant Retail)</option>
                  <option value="admin">Super Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Estado Inicial
                </label>
                <select
                  name="estado"
                  value={form.estado}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-sm text-slate-100 cursor-pointer"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Vigencia Inicial (Opcional)
                </label>
                <input
                  name="activoHasta"
                  type="date"
                  value={form.activoHasta}
                  onChange={handleChange}
                  className="w-full h-11 px-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateSection(false)}
                className="btn-secondary text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary text-sm px-6 shadow-lg shadow-indigo-950/50"
              >
                {loading ? 'Creando cuenta...' : 'Guardar y Crear Usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Barra de Búsqueda Reactiva y Filtros Múltiples */}
      <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Input de Búsqueda */}
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, correo o UID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-indigo-500/80 text-sm text-slate-100 placeholder:text-slate-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filtros Dropdowns / Chips */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Filtro Plan */}
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 cursor-pointer"
            >
              <option value="todos">Todos los Planes</option>
              {planes.map((p) => (
                <option key={p.id} value={p.nombre}>
                  Plan {p.nombre}
                </option>
              ))}
              <option value="sin_plan">Sin Suscripción Activa</option>
            </select>

            {/* Filtro Estado */}
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value as any)}
              className="h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 cursor-pointer"
            >
              <option value="todos">Todos los Estados</option>
              <option value="activo">Solo Activos</option>
              <option value="inactivo">Solo Inactivos</option>
            </select>

            {/* Filtro Email Verificado */}
            <select
              value={verificadoFilter}
              onChange={(e) => setVerificadoFilter(e.target.value as any)}
              className="h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 cursor-pointer"
            >
              <option value="todos">Verificación de Email</option>
              <option value="verificado">Email Verificado</option>
              <option value="pendiente">Email Pendiente</option>
            </select>

            {/* Filtro Rol */}
            <select
              value={rolFilter}
              onChange={(e) => setRolFilter(e.target.value as any)}
              className="h-10 px-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 cursor-pointer"
            >
              <option value="todos">Todos los Roles</option>
              <option value="usuario">Tenants (Usuarios)</option>
              <option value="admin">Administradores</option>
            </select>
          </div>
        </div>

        {/* Resumen de conteo */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
          <div>
            Total encontrados:{' '}
            <span className="font-bold text-white">{filteredUsuarios.length}</span> de{' '}
            <span>{usuarios.length}</span> usuarios
          </div>
          {(searchTerm || planFilter !== 'todos' || estadoFilter !== 'todos' || verificadoFilter !== 'todos' || rolFilter !== 'todos') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setPlanFilter('todos');
                setEstadoFilter('todos');
                setVerificadoFilter('todos');
                setRolFilter('todos');
              }}
              className="text-cyan-400 hover:underline text-xs"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Usuarios Dark SaaS */}
      <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800/80 overflow-hidden text-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs font-semibold">
                <th className="px-6 py-4">Usuario / Tenant</th>
                <th className="px-4 py-4">Rol</th>
                <th className="px-4 py-4 text-center">Verificación</th>
                <th className="px-4 py-4 text-center">Plan Vigente</th>
                <th className="px-4 py-4 text-center">Estado</th>
                <th className="px-4 py-4">Fecha Registro</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {paginatedUsuarios.length > 0 ? (
                paginatedUsuarios.map((u) => {
                  const isVerif = Boolean(verificados[u.id] || u.emailVerified || u.verificadoEn);
                  const suscripcion = getSuscripcionActiva(u.id);
                  const fechaRegistro = formatDate(u.createdAt);

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedUserForDrawer(u)}
                    >
                      {/* Avatar & Nombre */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 border border-indigo-500/30 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
                            {u.nombre ? u.nombre.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate hover:text-cyan-300 transition-colors">
                              {u.nombre}
                            </p>
                            <p className="text-xs text-slate-400 font-mono truncate">
                              {u.correo || u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            u.rol === 'admin'
                              ? 'bg-purple-950/60 text-purple-300 border-purple-800/50'
                              : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50'
                          }`}
                        >
                          <Shield size={12} className="inline mr-1" />
                          {u.rol === 'admin' ? 'Admin' : 'Tenant'}
                        </span>
                      </td>

                      {/* Verificación */}
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {isVerif ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 text-xs font-semibold">
                            <MailCheck size={13} />
                            <span>Verificado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/50 text-xs font-semibold">
                            <Mail size={13} />
                            <span>Pendiente</span>
                          </span>
                        )}
                      </td>

                      {/* Plan Actual */}
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {suscripcion ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-950/60 text-cyan-300 border border-indigo-800/50 text-xs font-semibold">
                            <Package size={13} />
                            <span>{suscripcion.planNombre}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            u.estado === 'activo'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                              : 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                          }`}
                        >
                          {u.estado === 'activo' ? (
                            <>
                              <UserCheck size={13} />
                              <span>Activo</span>
                            </>
                          ) : (
                            <>
                              <UserX size={13} />
                              <span>Inactivo</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Fecha Registro */}
                      <td className="px-4 py-4 text-xs text-slate-400">
                        {fechaRegistro}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedUserForDrawer(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/50 transition-colors text-xs font-semibold"
                            title="Ver telemetría y panel 360°"
                          >
                            <Activity size={14} />
                            <span>360°</span>
                          </button>

                          <button
                            onClick={() => abrirCambiarPlan(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900 border border-indigo-800/50 transition-colors text-xs font-semibold"
                            title="Modificar plan"
                          >
                            <Package size={14} />
                            <span>Plan</span>
                          </button>

                          <button
                            onClick={() => toggleEstado(u.id, u.estado)}
                            disabled={togglingId === u.id}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                              u.estado === 'activo'
                                ? 'bg-rose-950/40 text-rose-400 border-rose-800/40 hover:bg-rose-900/50'
                                : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/50'
                            }`}
                          >
                            {togglingId === u.id
                              ? '...'
                              : u.estado === 'activo'
                              ? 'Desactivar'
                              : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-500">
                    <Users size={48} className="mx-auto mb-3 text-slate-700" />
                    <p className="font-semibold text-slate-400">No se encontraron usuarios</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Probá ajustando los términos de búsqueda o filtros seleccionados
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {filteredUsuarios.length > itemsPerPage && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
            <Paginador
              currentPage={currentPage}
              totalItems={filteredUsuarios.length}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => setCurrentPage(page)}
              onItemsPerPageChange={(limit) => {
                setItemsPerPage(limit);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Slide-over Drawer 360° */}
      {selectedUserForDrawer && (
        <UsuarioDrawer
          usuario={selectedUserForDrawer}
          isOpen={Boolean(selectedUserForDrawer)}
          onClose={() => setSelectedUserForDrawer(null)}
          suscripcionActiva={getSuscripcionActiva(selectedUserForDrawer.id)}
          planes={planes}
          isVerificado={Boolean(
            verificados[selectedUserForDrawer.id] ||
              selectedUserForDrawer.emailVerified ||
              selectedUserForDrawer.verificadoEn
          )}
          onOpenChangePlan={(u) => {
            setSelectedUserForDrawer(null);
            abrirCambiarPlan(u);
          }}
          onUserUpdated={() => {
            setSelectedUserForDrawer(null);
          }}
        />
      )}

      {/* Modal: Cambiar plan */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">Cambiar Plan de Suscripción</h2>
                <p className="text-slate-400 mt-0.5 text-xs">{planModal.usuarioNombre}</p>
              </div>
              <button
                onClick={() => setPlanModal(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Plan actual:
                </span>
                <p className="font-bold text-cyan-300 mt-0.5">{planModal.planActual}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Seleccionar nuevo plan
                </label>
                <select
                  value={nuevoPlanId}
                  onChange={(e) => setNuevoPlanId(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-sm text-slate-100"
                >
                  <option value="">Seleccionar plan...</option>
                  {planes
                    .filter((p) => p.activo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} — {formatearDesdeBase(p.precio)} ({p.duracionDias} días)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPlanModal(null)}
                  className="btn-secondary flex-1 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCambiarPlan}
                  disabled={guardandoPlan || !nuevoPlanId}
                  className="btn-primary flex-1 text-sm shadow-lg shadow-indigo-950/50"
                >
                  {guardandoPlan ? 'Guardando...' : 'Confirmar Cambio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Sincronización con Auth y Purga de Huérfanos */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 animate-scale-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <RefreshCw size={20} className={syncLoading ? 'animate-spin' : ''} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    Sincronización Auth ↔ Firestore
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Auditoría de integridad, detección de discrepancias y purga de huérfanos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {syncLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
                  <RefreshCw size={32} className="animate-spin text-cyan-400" />
                  <p className="text-sm font-medium">Auditando cuentas de Firebase Auth y Firestore...</p>
                </div>
              ) : syncResult ? (
                <>
                  {/* Summary Metric Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-center space-y-1">
                      <div className="flex items-center justify-center text-indigo-400 mb-1">
                        <Shield size={18} />
                      </div>
                      <p className="text-2xl font-black text-white">{syncResult.totalAuth}</p>
                      <p className="text-[11px] font-medium text-slate-400">Firebase Auth</p>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-center space-y-1">
                      <div className="flex items-center justify-center text-cyan-400 mb-1">
                        <Database size={18} />
                      </div>
                      <p className="text-2xl font-black text-white">{syncResult.totalFirestore}</p>
                      <p className="text-[11px] font-medium text-slate-400">Firestore Docs</p>
                    </div>

                    <div
                      className={`border rounded-xl p-3 text-center space-y-1 ${
                        syncResult.huerfanosFirestore.length > 0
                          ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-center text-rose-400 mb-1">
                        <UserX size={18} />
                      </div>
                      <p
                        className={`text-2xl font-black ${
                          syncResult.huerfanosFirestore.length > 0 ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        {syncResult.huerfanosFirestore.length}
                      </p>
                      <p className="text-[11px] font-medium">Huérfanos Firestore</p>
                    </div>

                    <div
                      className={`border rounded-xl p-3 text-center space-y-1 ${
                        syncResult.huerfanosAuth.length > 0
                          ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                          : 'bg-slate-950/70 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-center text-amber-400 mb-1">
                        <AlertCircle size={18} />
                      </div>
                      <p
                        className={`text-2xl font-black ${
                          syncResult.huerfanosAuth.length > 0 ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        {syncResult.huerfanosAuth.length}
                      </p>
                      <p className="text-[11px] font-medium">Huérfanos Auth</p>
                    </div>
                  </div>

                  {/* Synchronized State or Tabs */}
                  {syncResult.huerfanosFirestore.length === 0 && syncResult.huerfanosAuth.length === 0 ? (
                    <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-2xl p-6 flex items-center gap-4 text-emerald-300">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={28} className="text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">¡Base de datos 100% Sincronizada!</h4>
                        <p className="text-xs text-emerald-300/80 mt-1">
                          No se encontraron discrepancias ni registros huérfanos entre Firebase Auth y la colección de Firestore.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Tabs */}
                      <div className="flex border-b border-slate-800 gap-2">
                        <button
                          onClick={() => setActiveSyncTab('firestore')}
                          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                            activeSyncTab === 'firestore'
                              ? 'border-rose-500 text-rose-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <UserX size={15} />
                          <span>Huérfanos en Firestore ({syncResult.huerfanosFirestore.length})</span>
                        </button>
                        <button
                          onClick={() => setActiveSyncTab('auth')}
                          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                            activeSyncTab === 'auth'
                              ? 'border-amber-500 text-amber-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <AlertCircle size={15} />
                          <span>Huérfanos en Auth ({syncResult.huerfanosAuth.length})</span>
                        </button>
                      </div>

                      {/* Tab Content */}
                      {activeSyncTab === 'firestore' ? (
                        <div className="space-y-2.5">
                          <p className="text-xs text-slate-400">
                            Documentos en <code className="text-indigo-300">usuarios</code> cuyo UID ya no existe en Firebase Auth. Pueden eliminarse de forma segura con sus suscripciones.
                          </p>

                          {syncResult.huerfanosFirestore.length === 0 ? (
                            <div className="p-4 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500">
                              No hay huérfanos en Firestore.
                            </div>
                          ) : (
                            <div className="max-h-56 overflow-y-auto space-y-2">
                              {syncResult.huerfanosFirestore.map((h) => (
                                <div
                                  key={h.uid}
                                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-rose-950/60"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-200 truncate">{h.nombre || 'Sin nombre'}</p>
                                    <p className="text-[11px] text-cyan-300/80 truncate">{h.email || 'Sin email'}</p>
                                    <p className="text-[10px] text-slate-500 font-mono truncate">UID: {h.uid}</p>
                                  </div>
                                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60">
                                    Sin Auth
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <p className="text-xs text-slate-400">
                            Cuentas registradas en Firebase Auth que no tienen un documento asociado en la colección <code className="text-indigo-300">usuarios</code>.
                          </p>

                          {syncResult.huerfanosAuth.length === 0 ? (
                            <div className="p-4 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500">
                              No hay huérfanos en Firebase Auth.
                            </div>
                          ) : (
                            <div className="max-h-56 overflow-y-auto space-y-2">
                              {syncResult.huerfanosAuth.map((h) => (
                                <div
                                  key={h.uid}
                                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-amber-950/60"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-200 truncate">{h.nombre || 'Usuario Auth'}</p>
                                    <p className="text-[11px] text-cyan-300/80 truncate">{h.email || 'Sin email'}</p>
                                    <p className="text-[10px] text-slate-500 font-mono truncate">UID: {h.uid}</p>
                                  </div>
                                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                                    Sin Doc
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-3">
              <button
                type="button"
                onClick={abrirModalSincronizar}
                disabled={syncLoading || purging}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                <RefreshCw size={14} className={syncLoading ? 'animate-spin' : ''} />
                <span>Re-auditar</span>
              </button>

              <div className="flex items-center gap-2">
                {syncResult && syncResult.huerfanosFirestore.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePurgarHuerfanos}
                    disabled={purging || syncLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 transition-all disabled:opacity-50"
                  >
                    {purging ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Purgando...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        <span>Purgar {syncResult.huerfanosFirestore.length} Usuarios Huérfanos</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  disabled={purging}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
