import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function VerificarEmail() {
  const { user, sendVerificationEmail, refreshUser } = useAuth();
  const nav = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [revisando, setRevisando] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (user.emailVerified || user.rol === 'admin') return <Navigate to="/" replace />;

  const handleReenviar = async () => {
    setEnviando(true);
    try {
      await sendVerificationEmail();
      toast.success('Correo de verificación enviado. Revisá tu bandeja de entrada.');
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'functions/resource-exhausted') {
        toast.error('Esperá un minuto antes de reenviar el correo');
      } else {
        toast.error(error.message || 'Error al enviar el correo');
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleYaVerifique = async () => {
    setRevisando(true);
    try {
      const verificado = await refreshUser();
      if (verificado) {
        toast.success('Correo verificado. Bienvenido!');
        nav('/');
      } else {
        toast('Todavía no está verificado. Revisá tu bandeja de entrada y hacé click en el link del correo.');
      }
    } catch {
      toast.error('Error al verificar. Intentá de nuevo.');
    } finally {
      setRevisando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-gradient-to-tr from-indigo-900 via-indigo-800 to-violet-900 overflow-hidden px-4 font-sans">
      <div className="relative z-10 w-full max-w-md bg-white bg-opacity-15 backdrop-blur-lg rounded-3xl shadow-2xl p-10 animate-fadeInUp">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-indigo-500/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-white">Verificá tu correo</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Te enviamos un link de verificación a <strong className="text-white">{user.email}</strong>.
            Hacé click en el link para activar tu cuenta.
          </p>
          <div className="bg-white/10 rounded-xl px-4 py-3 w-full">
            <p className="text-xs text-white/50">
              <strong className="text-white/70">No lo recibiste?</strong> Revisá la carpeta de spam o correo no deseado.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReenviar}
            disabled={enviando}
            className="btn rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-600 transition-colors duration-500 text-white font-semibold py-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide w-full"
          >
            {enviando ? 'Enviando...' : 'Reenviar correo'}
          </button>
          <button
            type="button"
            onClick={handleYaVerifique}
            disabled={revisando}
            className="btn rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/20 font-semibold py-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-base tracking-wide w-full transition-colors"
          >
            {revisando ? 'Verificando...' : 'Ya verifiqué mi correo'}
          </button>
        </div>
      </div>
    </div>
  );
}
