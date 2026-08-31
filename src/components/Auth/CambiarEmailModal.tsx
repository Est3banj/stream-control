import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface CambiarEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEmail: string) => void;
  currentEmail?: string;
}

export const CambiarEmailModal: React.FC<CambiarEmailModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentEmail = '',
}) => {
  const { updateUserEmail, sendVerificationEmail } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const emailTrimmed = newEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      setErrorMsg('Ingresá el nuevo correo electrónico');
      return;
    }

    if (emailTrimmed === currentEmail.toLowerCase()) {
      setErrorMsg('El nuevo correo no puede ser idéntico al actual');
      return;
    }

    // Validación básica de formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setErrorMsg('Ingresá un formato de correo válido (ej. usuario@dominio.com)');
      return;
    }

    if (!password) {
      setErrorMsg('Ingresá tu contraseña actual para confirmar el cambio');
      return;
    }

    setLoading(true);
    try {
      await updateUserEmail(emailTrimmed, password);
      // Reenviar email de verificación al nuevo correo
      try {
        await sendVerificationEmail();
      } catch (sendErr) {
        console.warn('Error reenviando verificación:', sendErr);
      }

      toast.success('Correo actualizado. Te enviamos un nuevo enlace.');
      onSuccess(emailTrimmed);
      onClose();
    } catch (err: unknown) {
      console.error('Error al cambiar email:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErrorMsg('Contraseña incorrecta. Verificá tus credenciales.');
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMsg('Este correo electrónico ya está registrado en el sistema.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMsg('El correo ingresado no es válido.');
      } else if (error.code === 'auth/requires-recent-login') {
        setErrorMsg('Por seguridad, volvé a iniciar sesión antes de modificar tu correo.');
      } else {
        setErrorMsg(error.message || 'Error al actualizar el correo. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!loading ? onClose : undefined}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-md bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl text-white"
          >
            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute top-5 right-5 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Corregir correo</h3>
                <p className="text-xs text-white/60">Actualizá tu dirección de email</p>
              </div>
            </div>

            {currentEmail && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-5 text-xs text-white/70">
                <span>Correo actual registrado:</span>{' '}
                <strong className="text-white block font-medium mt-0.5 truncate">{currentEmail}</strong>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 bg-rose-500/20 border border-rose-500/30 rounded-xl p-3 mb-4 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">
                  Nuevo Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ejemplo@dominio.com"
                    required
                    autoFocus
                    className="w-full rounded-2xl pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">
                  Tu Contraseña Actual (Confirmación)
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-2xl pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Actualizar y Enviar</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CambiarEmailModal;
