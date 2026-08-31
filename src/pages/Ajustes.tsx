import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { callFunction } from '../lib/apiClient';
import { User, Mail, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MONEDAS } from '../types/usuario';
import { useMoneda } from '../hooks/useMoneda';

type ModalType = 'email' | 'password' | null;

export default function Ajustes() {
  const { user, logout, updateProfileData, updateUserEmail, updateUserPassword } = useAuth();
  const { moneda: monedaActual } = useMoneda();

  const [nombre, setNombre] = useState(user?.nombre || '');
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [moneda, setMoneda] = useState(monedaActual);
  const [guardandoMoneda, setGuardandoMoneda] = useState(false);

  const [modal, setModal] = useState<ModalType>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleSaveNombre = async () => {
    if (!nombre.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    setGuardandoNombre(true);
    try {
      await updateProfileData({ nombre: nombre.trim() });
      toast.success('Nombre actualizado correctamente');
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Error al actualizar el nombre');
    } finally {
      setGuardandoNombre(false);
    }
  };

  const handleSaveMoneda = async () => {
    setGuardandoMoneda(true);
    try {
      const monedaInfo = MONEDAS.find(m => m.codigo === moneda);
      const tasa = monedaInfo?.defTasa ?? 1;
      await updateProfileData({ moneda, tasa });
      toast.success(`Moneda actualizada a ${moneda}`);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Error al actualizar la moneda');
    } finally {
      setGuardandoMoneda(false);
    }
  };

  const abrirModal = (tipo: ModalType) => {
    setCurrentPassword('');
    setNewEmail('');
    setNewPassword('');
    setConfirmPassword('');
    setModal(tipo);
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('El nuevo correo es obligatorio');
      return;
    }
    if (!currentPassword) {
      toast.error('Ingresá tu contraseña actual');
      return;
    }
    setGuardando(true);
    try {
      await updateUserEmail(newEmail.trim(), currentPassword);
      toast.success('Correo actualizado. Verificá el correo nuevo para seguir usando la app.', { duration: 5000 });
      setModal(null);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/wrong-password') {
        toast.error('Contraseña incorrecta');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Ese correo ya está en uso');
      } else {
        toast.error(error.message || 'Error al cambiar el correo');
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Ingresá tu contraseña actual');
      return;
    }
    if (!newPassword) {
      toast.error('Ingresá la nueva contraseña');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setGuardando(true);
    try {
      await updateUserPassword(newPassword, currentPassword);
      toast.success('Contraseña actualizada. Por seguridad, inicia sesión nuevamente');
      setModal(null);
      setTimeout(() => {
        logout();
      }, 3000);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/wrong-password') {
        toast.error('Contraseña incorrecta');
      } else {
        toast.error(error.message || 'Error al cambiar la contraseña');
      }
    } finally {
      setGuardando(false);
    }
  };

  const [recuperandoPass, setRecuperandoPass] = useState(false);

  const handlePasswordReset = async () => {
    if (!user?.email || !user?.nombre) {
      toast.error('No se encontró tu correo electrónico');
      return;
    }
    setRecuperandoPass(true);
    try {
      await callFunction('enviarCorreoRecuperacion', { email: user.email, nombre: user.nombre });
      toast.success('Te enviamos un enlace para restablecer tu contraseña');
      setModal(null);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      toast.error(error.message || 'Error al enviar el correo de recuperación');
    } finally {
      setRecuperandoPass(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          Ajustes
        </h1>
        <p className="text-slate-400">Gestiona tu perfil y configuración</p>
      </div>

      {/* Section 1: Nombre */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800">
          <User className="text-indigo-400" size={24} />
          <h2 className="text-xl font-bold text-white">Nombre</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500"
            />
          </div>
          <button
            onClick={handleSaveNombre}
            disabled={guardandoNombre}
            className="btn-primary shadow-lg shadow-indigo-950/50"
          >
            {guardandoNombre ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Section: Moneda */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800">
          <User className="text-indigo-400" size={24} />
          <h2 className="text-xl font-bold text-white">Moneda</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Moneda predeterminada</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100"
            >
              {MONEDAS.map(m => (
                <option key={m.codigo} value={m.codigo}>
                  {m.simbolo} — {m.pais} ({m.codigo})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSaveMoneda}
            disabled={guardandoMoneda}
            className="btn-primary shadow-lg shadow-indigo-950/50"
          >
            {guardandoMoneda ? 'Guardando...' : 'Guardar moneda'}
          </button>
        </div>
      </div>

      {/* Section 2: Correo */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800">
          <Mail className="text-indigo-400" size={24} />
          <h2 className="text-xl font-bold text-white">Correo electrónico</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Correo actual</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full opacity-60 cursor-not-allowed bg-slate-950/60 border border-slate-800 text-slate-300 font-mono"
            />
          </div>
          <button
            onClick={() => abrirModal('email')}
            className="btn-primary shadow-lg shadow-indigo-950/50"
          >
            Cambiar correo
          </button>
        </div>
      </div>

      {/* Section 3: Contraseña */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800">
          <Lock className="text-indigo-400" size={24} />
          <h2 className="text-xl font-bold text-white">Contraseña</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Contraseña actual</label>
            <input
              type="password"
              value="********"
              disabled
              className="w-full opacity-60 cursor-not-allowed bg-slate-950/60 border border-slate-800 text-slate-300 font-mono"
            />
          </div>
          <button
            onClick={() => abrirModal('password')}
            className="btn-primary shadow-lg shadow-indigo-950/50"
          >
            Cambiar contraseña
          </button>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100 animate-scale-in">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {modal === 'email' ? 'Cambiar correo' : 'Cambiar contraseña'}
                </h2>
                <p className="text-slate-400 mt-1 text-sm">
                  {modal === 'email'
                    ? 'Ingresá tu nueva dirección de correo'
                    : 'Ingresá tu nueva contraseña'}
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Contraseña actual (ambos modales) */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Contraseña actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ingresá tu contraseña actual"
                  className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
                />
                {modal === 'password' && (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={recuperandoPass}
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline mt-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {recuperandoPass ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
                  </button>
                )}
              </div>

              {modal === 'email' ? (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Nuevo correo</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nuevo@correo.com"
                    className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Confirmar nueva contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repetí la nueva contraseña"
                      className="w-full bg-slate-900/80 border border-slate-700/80 text-slate-100 placeholder-slate-500 font-mono"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setModal(null)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={modal === 'email' ? handleChangeEmail : handleChangePassword}
                  disabled={guardando}
                  className="btn-primary flex-1 shadow-lg shadow-indigo-950/50"
                >
                  {guardando ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
