// src/pages/Usuarios.tsx
import React, { useEffect, useState } from 'react';
import { collection, doc, setDoc, updateDoc, onSnapshot, Timestamp, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as signOutAuth } from 'firebase/auth';
import { auth, db, secondaryAuth } from '../firebase';
import { UserPlus, Users, Shield, UserCheck, UserX, Mail, Eye, EyeOff, Package, X } from 'lucide-react';
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
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value } as UsuarioFormState);
  };

  // Genera contraseña temporal si el admin no escribe una
  const generarPasswordTemporal = () => {
    return `Tmp-${Math.random().toString(36).slice(2, 10)}A!`;
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
        activoHasta: form.activoHasta || '',
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

  const toggleEstado = async (uid: string, estadoActual: string) => {
    try {
      const ref = doc(db, 'usuarios', uid);
      await updateDoc(ref, { estado: estadoActual === 'activo' ? 'inactivo' : 'activo' });
      toast.success(`Usuario ${estadoActual === 'activo' ? 'desactivado' : 'activado'} correctamente`);
    } catch (err: unknown) {
      console.error(err);
      toast.error('No se pudo actualizar el estado');
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
          Gestión de Usuarios
        </h1>
        <p className="text-gray-600">Administra los usuarios del sistema</p>
      </div>

      {/* Formulario de creación */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <UserPlus className="text-indigo-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Crear Nuevo Usuario</h2>
        </div>

        <form onSubmit={handleCrearUsuario} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre *</label>
              <input
                name="nombre"
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={handleChange}
                className="w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Correo *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  name="correo"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.correo}
                  onChange={handleChange}
                  className="w-full pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Opcional (se generará automática)"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
              <select name="rol" value={form.rol} onChange={handleChange} className="w-full">
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select name="estado" value={form.estado} onChange={handleChange} className="w-full">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Activo hasta</label>
              <input
                name="activoHasta"
                type="date"
                value={form.activoHasta}
                onChange={handleChange}
                className="w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            <UserPlus size={20} />
            {loading ? 'Creando...' : 'Crear Usuario'}
          </button>
        </form>
      </div>

      {/* Lista de usuarios */}
      <div className="card overflow-hidden p-0">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Usuarios Registrados</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold">Nombre</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Correo</th>
                <th className="px-4 py-4 text-left text-sm font-semibold">Rol</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Plan Actual</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Estado</th>
                <th className="px-4 py-4 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length > 0 ? (
                usuarios.map(u => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-4 py-4 font-medium text-gray-900">{u.nombre}</td>
                    <td className="px-4 py-4 text-gray-700">{u.correo}</td>
                    <td className="px-4 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${u.rol === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                        }`}>
                        <Shield size={14} className="inline mr-1" />
                        {u.rol === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {(() => {
                        const s = getSuscripcionActiva(u.id);
                        return s ? (
                          <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
                            <Package size={14} className="inline mr-1" />
                            {s.planNombre}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${u.estado === 'activo'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
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
                          className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors text-sm font-medium"
                          title="Cambiar plan"
                        >
                          <Package size={16} className="inline mr-1" />
                          Plan
                        </button>
                        <button
                          onClick={() => toggleEstado(u.id, u.estado)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            u.estado === 'activo'
                              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                          }`}
                        >
                          {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <Users size={48} className="mx-auto mb-3 text-gray-300" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-md w-full animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Cambiar plan</h2>
                <p className="text-gray-600 mt-1 text-sm">{planModal.usuarioNombre}</p>
              </div>
              <button onClick={() => setPlanModal(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-sm text-gray-500">Plan actual:</span>
                <p className="font-semibold text-gray-900 mt-0.5">{planModal.planActual}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nuevo plan</label>
                <select
                  value={nuevoPlanId}
                  onChange={(e) => setNuevoPlanId(e.target.value)}
                  className="w-full"
                >
                  <option value="">Seleccionar plan...</option>
                  {planes.filter(p => p.activo).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — ${p.precio.toLocaleString()} ({p.duracionDias} días)
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
