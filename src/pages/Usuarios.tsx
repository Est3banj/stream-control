// src/pages/Usuarios.tsx
import React, { useEffect, useState } from 'react';
import { collection, doc, setDoc, updateDoc, onSnapshot, Timestamp, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as signOutAuth } from 'firebase/auth';
import { callFunction } from '../lib/apiClient';
import { auth, db, secondaryAuth } from '../firebase';
import { useMoneda } from '../hooks/useMoneda';
import { UserPlus, Users, Shield, UserCheck, UserX, Mail, MailCheck, Eye, EyeOff, Package, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import useSuscripciones, { crearSuscripcion, actualizarSuscripcion } from '../hooks/useSuscripciones';
import usePlanes from '../hooks/usePlanes';
import type { Usuario } from '../types/usuario';

interface UsuarioFormState {
  nombre: string;
  correo: string;
  password: string;
  rol: 'admin' | 'usuario';
  estado: 'activo' | 'inactivo';
  activoHasta: string;
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
  const [form, setForm] = useState<UsuarioFormState>({
    nombre: '',
    correo: '',
    password: '',
    rol: 'usuario',
    estado: 'activo',
    activoHasta: '',
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'usuarios'), (snapshot: QuerySnapshot<DocumentData>) => {
      setUsuarios(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Usuario)));
    }, (error: Error) => {
      console.error('Error cargando usuarios:', error);
      toast.error('Error al cargar usuarios');
    });

    return () => unsubscribe();
  }, []);

  // Cargar emailVerified de Firebase Auth (no está en Firestore)
  useEffect(() => {
    (async () => {
      try {
        const data = await callFunction<Record<string, never>, { verificados: Record<string, boolean> }>('listarVerificados');
        setVerificados(data.verificados || {});
      } catch {
        // Si falla, no mostrar el badge
      }
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value } as UsuarioFormState);
  };

  // Genera contraseña temporal segura si el admin no escribe una
  const generarPasswordTemporal = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return `Tmp-${Array.from(array, byte => chars[byte % chars.length]).join('')}A!`;
  };

  const handleCrearUsuario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.nombre || !form.correo) {
      alert('Nombre y correo son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const passwordToUse = form.password?.trim() ? form.password : generarPasswordTemporal();

      // Crear usuario con secondaryAuth para no cerrar sesión actual
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, form.correo, passwordToUse);

      const profile = {
        nombre: form.nombre,
        correo: form.correo,
        rol: form.rol || 'usuario',
        estado: form.estado || 'activo',
        activoHasta: form.activoHasta ? Timestamp.fromDate(new Date(form.activoHasta)) : null,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'usuarios', userCred.user.uid), profile);

      // Enviar email de restablecimiento si no se definió contraseña
      if (!form.password?.trim()) {
        try {
          await sendPasswordResetEmail(secondaryAuth, form.correo);
        } catch (err: unknown) {
          console.warn('No se pudo enviar email de restablecimiento:', err);
        }
      }

      // Cerrar sesión secundaria para evitar interferencias
      try {
        await signOutAuth(secondaryAuth);
      } catch (e: unknown) {
        console.warn('No se pudo cerrar secondaryAuth:', e);
      }

      toast.success('Usuario creado correctamente.');
      setForm({ nombre: '', correo: '', password: '', rol: 'usuario', estado: 'activo', activoHasta: '' });
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

  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  // Estado para el modal de cambio de plan
  const [planModal, setPlanModal] = useState<{
    usuarioId: string;
    usuarioNombre: string;
    suscripcionId: string | null;
    planActual: string;
  } | null>(null);

  const [nuevoPlanId, setNuevoPlanId] = useState('');
  const [guardandoPlan, setGuardandoPlan] = useState(false);

  const abrirCambiarPlan = (uid: string, nombre: string) => {
    const susc = suscripciones.find(s => s.usuarioId === uid && s.estado === 'activa');
    setPlanModal({
      usuarioId: uid,
      usuarioNombre: nombre,
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

    const plan = planes.find(p => p.id === nuevoPlanId);
    if (!plan) {
      toast.error('Plan no encontrado');
      return;
    }

    setGuardandoPlan(true);
    try {
      if (planModal.suscripcionId) {
        // Actualizar suscripción existente
        await actualizarSuscripcion(planModal.suscripcionId, {
          planId: plan.id,
          planNombre: plan.nombre,
        });
        toast.success(`Plan de ${planModal.usuarioNombre} cambiado a ${plan.nombre}`);
      } else {
        // Crear nueva suscripción activa
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

  /** Obtiene la suscripción activa de un usuario */
  const getSuscripcionActiva = (uid: string) =>
    suscripciones.find(s => s.usuarioId === uid && s.estado === 'activa');

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header */}
      <div className="mb-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Gestión de Usuarios
          </h1>
          <p className="text-slate-400">Administra los usuarios del sistema</p>
        </div>
      </div>

      {/* Formulario de creación */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800">
          <UserPlus className="text-indigo-400" size={24} />
          <h2 className="text-xl font-bold text-white">Crear Nuevo Usuario</h2>
        </div>

        <form onSubmit={handleCrearUsuario} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Nombre *</label>
              <input
                name="nombre"
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={handleChange}
                className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Correo *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  name="correo"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.correo}
                  onChange={handleChange}
                  className="w-full pl-10 bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Contraseña</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Opcional (se generará automática)"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full pr-10 bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Rol</label>
              <select name="rol" value={form.rol} onChange={handleChange} className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100">
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Estado</label>
              <select name="estado" value={form.estado} onChange={handleChange} className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Activo hasta</label>
              <input
                name="activoHasta"
                type="date"
                value={form.activoHasta}
                onChange={handleChange}
                className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
          >
            <UserPlus size={20} />
            {loading ? 'Creando...' : 'Crear Usuario'}
          </button>
        </form>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-slate-800 overflow-hidden text-slate-100">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="text-indigo-400" size={24} />
            <h2 className="text-xl font-bold text-white">Usuarios Registrados</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase tracking-wider text-xs">
                <th className="px-4 py-4 text-left font-semibold">Nombre</th>
                <th className="px-4 py-4 text-left font-semibold">Correo</th>
                <th className="px-4 py-4 text-left font-semibold">Rol</th>
                <th className="px-4 py-4 text-center font-semibold">Correo</th>
                <th className="px-4 py-4 text-center font-semibold">Plan Actual</th>
                <th className="px-4 py-4 text-center font-semibold">Estado</th>
                <th className="px-4 py-4 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length > 0 ? (
                usuarios.map(u => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-4 font-medium text-white">{u.nombre}</td>
                    <td className="px-4 py-4 text-slate-300 font-mono text-sm">{u.correo}</td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${u.rol === 'admin'
                          ? 'bg-purple-950/50 text-purple-300 border-purple-800/40'
                          : 'bg-indigo-950/50 text-indigo-300 border-indigo-800/40'
                        }`}>
                        <Shield size={14} className="inline mr-1" />
                        {u.rol === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {verificados[u.id] === undefined ? (
                        <span className="text-slate-500 text-sm">—</span>
                      ) : verificados[u.id] ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 text-xs font-medium">
                          <MailCheck size={14} className="inline mr-1" />
                          Verificado
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-amber-950/50 text-amber-400 border border-amber-800/40 text-xs font-medium">
                          <Mail size={14} className="inline mr-1" />
                          Sin verificar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(() => {
                        const s = getSuscripcionActiva(u.id);
                        return s ? (
                          <span className="px-3 py-1 rounded-full bg-indigo-950/50 text-cyan-300 border border-indigo-800/40 text-xs font-medium">
                            <Package size={14} className="inline mr-1" />
                            {s.planNombre}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${u.estado === 'activo'
                          ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                          : 'bg-rose-950/50 text-rose-400 border-rose-800/40'
                        }`}>
                        {u.estado === 'activo' ? (
                          <>
                            <UserCheck size={14} className="inline mr-1" />
                            Activo
                          </>
                        ) : (
                          <>
                            <UserX size={14} className="inline mr-1" />
                            Inactivo
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => abrirCambiarPlan(u.id, u.nombre)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900 border border-indigo-800/40 transition-colors text-xs font-medium"
                          title="Cambiar plan"
                        >
                          <Package size={14} className="inline mr-1" />
                          Plan
                        </button>
                        <button
                          onClick={() => toggleEstado(u.id, u.estado)}
                          disabled={togglingId === u.id || guardandoPlan}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            u.estado === 'activo'
                              ? 'bg-rose-950/40 text-rose-400 border-rose-800/40 hover:bg-rose-900/50'
                              : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/50'
                          }`}
                        >
                          {togglingId === u.id ? 'Procesando...' : (u.estado === 'activo' ? 'Desactivar' : 'Activar')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <Users size={48} className="mx-auto mb-3 text-slate-700" />
                    <p className="font-medium">No hay usuarios registrados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Cambiar plan */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Cambiar plan</h2>
                <p className="text-slate-400 mt-1 text-sm">{planModal.usuarioNombre}</p>
              </div>
              <button onClick={() => setPlanModal(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3">
                <span className="text-xs text-slate-400 uppercase tracking-wide">Plan actual:</span>
                <p className="font-semibold text-cyan-300 mt-0.5">{planModal.planActual}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Nuevo plan</label>
                <select
                  value={nuevoPlanId}
                  onChange={(e) => setNuevoPlanId(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
                >
                  <option value="">Seleccionar plan...</option>
                  {planes.filter(p => p.activo).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {formatearDesdeBase(p.precio)} ({p.duracionDias} días)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setPlanModal(null)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCambiarPlan}
                  disabled={guardandoPlan || !nuevoPlanId}
                  className="btn-primary flex-1"
                >
                  {guardandoPlan ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
