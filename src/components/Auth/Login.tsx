import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { callFunction } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import AuthLayout from './AuthLayout';
import Register from './Register';

type Modo = 'login' | 'register';

interface LoginProps {
  initialModo?: Modo;
}

export default function Login({ initialModo = 'login' }: LoginProps) {
  const { user, loading: authLoading, login, loginWithGoogle } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [modo, setModo] = useState<Modo>(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'register') return 'register';
    return initialModo;
  });

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Password Recovery state
  const [mostrarRecuperacion, setMostrarRecuperacion] = useState(false);
  const [emailRecuperacion, setEmailRecuperacion] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  // Redirigir al dashboard si ya está autenticado y verificado
  useEffect(() => {
    if (!authLoading && user && (user.emailVerified || user.rol === 'admin')) {
      nav('/', { replace: true });
    }
  }, [authLoading, user, nav]);

  // Sync mode with query params if changed externally
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'register') {
      setModo('register');
    } else if (urlMode === 'login') {
      setModo('login');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const emailTrimmed = email.trim().toLowerCase();

    if (!emailTrimmed || !password.trim()) {
      toast.error('Por favor completá todos los campos');
      return;
    }

    setLoading(true);
    try {
      await login(emailTrimmed, password);
      toast.success('¡Bienvenido!');
      nav('/');
    } catch (error: unknown) {
      console.error('Error en login:', error);
      const err = error as { code?: string; message?: string };
      if (err.message?.includes('inactivo')) {
        toast.error('Tu cuenta está inactiva. Contactá al administrador.');
      } else if (err.message?.includes('no registrado')) {
        toast.error('Este usuario no está registrado.');
      } else if (err.message?.includes('Verificá tu correo') || err.message?.includes('verificar')) {
        toast.error('Verificá tu correo antes de continuar. Te redirigimos a la pantalla de verificación.');
        nav('/verificar-email');
      } else if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        toast.error('Correo o contraseña incorrectos.');
      } else {
        toast.error(err.message || 'Error al iniciar sesión. Inténtelo nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrimmed = emailRecuperacion.trim().toLowerCase();

    if (!emailTrimmed) {
      toast.error('Ingresá tu correo electrónico');
      return;
    }

    setRecuperando(true);
    try {
      await callFunction('enviarCorreoRecuperacion', { email: emailTrimmed });
      setEnviado(true);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'functions/resource-exhausted') {
        toast.error('Esperá un minuto antes de solicitar otro correo');
      } else {
        toast.error(error.message || 'Error al enviar el correo de recuperación');
      }
    } finally {
      setRecuperando(false);
    }
  };

  const abrirRecuperacion = () => {
    setEmailRecuperacion(email);
    setEnviado(false);
    setMostrarRecuperacion(true);
  };

  const cerrarRecuperacion = () => {
    setMostrarRecuperacion(false);
    setEnviado(false);
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle();
      toast.success('¡Bienvenido!');
      nav('/');
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      toast.error(err.message || 'Error al iniciar sesión con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle={
        mostrarRecuperacion
          ? 'Recuperación segura de acceso a tu cuenta'
          : modo === 'login'
          ? 'Ingresá a tu panel para gestionar tus ventas y suscripciones'
          : 'Comenzá a potenciar tu negocio de servicios digitales'
      }
    >
      <AnimatePresence initial={false}>
        {mostrarRecuperacion ? (
          /* ════════════════════════════════════════════════════════════════════════
             VISTA: RECUPERACIÓN DE CONTRASEÑA
             ════════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="recovery-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col"
          >
            {!enviado ? (
              <form onSubmit={handleRecuperar} className="flex flex-col gap-4">
                <div className="text-center mb-2">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                    <KeyRound className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    ¿Olvidaste tu contraseña?
                  </h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Ingresá tu correo registrado y te enviaremos las instrucciones para restablecerla.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
                    Correo electrónico registrado
                  </label>
                  <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
                    <Mail className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
                    <input
                      type="email"
                      value={emailRecuperacion}
                      onChange={(e) => setEmailRecuperacion(e.target.value)}
                      placeholder="tu@correo.com"
                      required
                      autoFocus
                      disabled={recuperando}
                      className="w-full bg-transparent focus:bg-transparent py-3 pr-4 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={recuperando}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/30 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {recuperando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando instrucciones...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar enlace de recuperación</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={cerrarRecuperacion}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              </form>
            ) : (
              /* ════════════════════════════════════════════════════════════════════════
                 CONFIRMACIÓN DE ENVÍO DE RECUPERACIÓN
                 ════════════════════════════════════════════════════════════════════════ */
              <div className="flex flex-col items-center text-center gap-4 py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Correo de recuperación enviado
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                    Enviamos las instrucciones a{' '}
                    <strong className="text-white font-semibold">{emailRecuperacion}</strong>.
                    Revisá tu bandeja de entrada o spam.
                  </p>
                </div>

                <div className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-left text-xs text-slate-400 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Si no encontrás el correo en unos minutos, verificá la carpeta de spam o correo no deseado.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cerrarRecuperacion}
                  className="w-full py-3 px-5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-white font-medium text-sm transition-all"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          /* ════════════════════════════════════════════════════════════════════════
             VISTA: LOGIN / REGISTER CON SEGMENTED TABS
             ════════════════════════════════════════════════════════════════════════ */
          <motion.div
            key="auth-main-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full flex flex-col"
          >
            {/* Segmented Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/70 border border-slate-800/80 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => setModo('login')}
                className={`relative py-2 text-xs font-semibold rounded-xl transition-all duration-200 select-none ${
                  modo === 'login' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {modo === 'login' && (
                  <motion.div
                    layoutId="auth-tab"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Iniciar sesión</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('register')}
                className={`relative py-2 text-xs font-semibold rounded-xl transition-all duration-200 select-none ${
                  modo === 'register' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {modo === 'register' && (
                  <motion.div
                    layoutId="auth-tab"
                    className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl shadow-md"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Crear cuenta</span>
              </button>
            </div>

            {modo === 'login' ? (
              /* ── Formulario de Login ── */
              <motion.div
                key="form-login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
                  {/* Correo */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
                      Correo electrónico
                    </label>
                    <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
                      <Mail className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@ejemplo.com"
                        autoComplete="email"
                        required
                        disabled={loading || googleLoading}
                        className="w-full bg-transparent focus:bg-transparent py-3 pr-4 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Contraseña */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 ml-1 mr-1">
                      <label className="text-xs font-medium text-slate-300">
                        Contraseña
                      </label>
                      <button
                        type="button"
                        onClick={abrirRecuperacion}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
                      <Lock className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        disabled={loading || googleLoading}
                        className="w-full bg-transparent focus:bg-transparent py-3 pr-10 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        className="absolute right-3 text-slate-400 hover:text-slate-200 p-1 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Botón Principal Iniciar Sesión */}
                  <button
                    type="submit"
                    disabled={loading || googleLoading}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/30 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Iniciando sesión...</span>
                      </>
                    ) : (
                      <>
                        <span>Entrar al panel</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Separador */}
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-slate-900/90 text-slate-500 font-medium uppercase tracking-wider">
                        o continua con
                      </span>
                    </div>
                  </div>

                  {/* Botón de Google */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading || googleLoading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 font-medium text-sm transition-all duration-200 shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {googleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                    )}
                    <span>Continuar con Google</span>
                  </button>

                  {/* Switch to Register */}
                  <div className="text-center mt-2">
                    <button
                      type="button"
                      onClick={() => setModo('register')}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      ¿No tenés cuenta?{' '}
                      <span className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4">
                        Crear cuenta gratis
                      </span>
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              /* ── Formulario de Registro Modular ── */
              <Register onSwitchToLogin={() => setModo('login')} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
