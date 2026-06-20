import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { User, Mail, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';

type ModalType = 'email' | 'password' | null;

export default function Ajustes() {
  const { user, logout, updateProfileData, updateUserEmail, updateUserPassword } = useAuth();

  const [nombre, setNombre] = useState(user?.nombre || '');
  const [guardandoNombre, setGuardandoNombre] = useState(false);

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
      toast.success('Correo actualizado correctamente');
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

  const handlePasswordReset = async () => {
    if (!user?.email || !user?.nombre) {
      toast.error('No se encontró tu correo electrónico');
      return;
    }
    try {
      const functions = getFunctions();
      const enviarRecuperacion = httpsCallable(functions, 'enviarCorreoRecuperacion');
      await enviarRecuperacion({ email: user.email, nombre: user.nombre });
      toast.success('Te enviamos un enlace para restablecer tu contraseña');
      setModal(null);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      toast.error(error.message || 'Error al enviar el correo de recuperación');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
          Ajustes
        </h1>
        <p className="text-gray-600">Gestiona tu perfil y configuración</p>
      </div>

      {/* Section 1: Nombre */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <User className="text-indigo-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Nombre</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <button
            onClick={handleSaveNombre}
            disabled={guardandoNombre}
            className="btn-primary"
          >
            {guardandoNombre ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Section 2: Correo */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="text-indigo-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Correo electrónico</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Correo actual</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full opacity-60 cursor-not-allowed"
            />
          </div>
          <button
            onClick={() => abrirModal('email')}
            className="btn-primary"
          >
            Cambiar correo
          </button>
        </div>
      </div>

      {/* Section 3: Contraseña */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="text-indigo-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Contraseña</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña actual</label>
            <input
              type="password"
              value="********"
              disabled
              className="w-full opacity-60 cursor-not-allowed"
            />
          </div>
          <button
            onClick={() => abrirModal('password')}
            className="btn-primary"
          >
            Cambiar contraseña
          </button>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card max-w-md w-full animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {modal === 'email' ? 'Cambiar correo' : 'Cambiar contraseña'}
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {modal === 'email'
                    ? 'Ingresá tu nueva dirección de correo'
                    : 'Ingresá tu nueva contraseña'}
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Contraseña actual (ambos modales) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Contraseña actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ingresá tu contraseña actual"
                />
                {modal === 'password' && (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline mt-1.5 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>

              {modal === 'email' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nuevo correo</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nuevo@correo.com"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmar nueva contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repetí la nueva contraseña"
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
                  className="btn-primary flex-1"
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
