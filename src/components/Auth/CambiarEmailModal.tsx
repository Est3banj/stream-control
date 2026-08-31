import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, X, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

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
  currentEmail = "",
}) => {
  const { updateUserEmail, enviarCodigoOTP, sendVerificationEmail } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const emailTrimmed = newEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      setErrorMsg("Ingresá el nuevo correo electrónico");
      return;
    }

    if (emailTrimmed === currentEmail.toLowerCase()) {
      setErrorMsg("El nuevo correo no puede ser idéntico al actual");
      return;
    }

    // Validación básica de formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setErrorMsg(
        "Ingresá un formato de correo válido (ej. usuario@dominio.com)",
      );
      return;
    }

    if (!password) {
      setErrorMsg("Ingresá tu contraseña actual para confirmar el cambio");
      return;
    }

    setLoading(true);
    try {
      await updateUserEmail(emailTrimmed, password);
      // Reenviar código OTP de verificación al nuevo correo
      try {
        if (enviarCodigoOTP) {
          await enviarCodigoOTP(emailTrimmed);
        } else {
          await sendVerificationEmail();
        }
      } catch (sendErr) {
        console.warn("Error reenviando código:", sendErr);
      }

      toast.success("Correo actualizado. Te enviamos un nuevo código.");
      onSuccess(emailTrimmed);
      onClose();
    } catch (err: unknown) {
      console.error("Error al cambiar email:", err);
      const error = err as { code?: string; message?: string };
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        setErrorMsg("Contraseña incorrecta. Verificá tus credenciales.");
      } else if (error.code === "auth/email-already-in-use") {
        setErrorMsg(
          "Este correo electrónico ya está registrado en el sistema.",
        );
      } else if (error.code === "auth/invalid-email") {
        setErrorMsg("El correo ingresado no es válido.");
      } else if (error.code === "auth/requires-recent-login") {
        setErrorMsg(
          "Por seguridad, volvé a iniciar sesión antes de modificar tu correo.",
        );
      } else {
        setErrorMsg(
          error.message || "Error al actualizar el correo. Intentá de nuevo.",
        );
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
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 text-white"
          >
            {/* Botón Cerrar */}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Corregir correo
                </h3>
                <p className="text-xs text-slate-400">
                  Actualizá tu dirección de email
                </p>
              </div>
            </div>

            {currentEmail && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 mb-4 text-xs text-slate-400">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 block font-medium mb-0.5">
                  Correo actual
                </span>
                <strong className="text-slate-200 font-semibold truncate block">
                  {currentEmail}
                </strong>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 mb-4 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
                  Nuevo correo electrónico
                </label>
                <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
                  <Mail className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ejemplo@dominio.com"
                    required
                    autoFocus
                    disabled={loading}
                    className="w-full bg-transparent focus:bg-transparent py-3 pr-4 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
                  Contraseña actual (Confirmación)
                </label>
                <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
                  <Lock className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full bg-transparent focus:bg-transparent py-3 pr-4 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-medium text-xs sm:text-sm transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/30 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
