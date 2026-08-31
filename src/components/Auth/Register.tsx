import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Coins,
  ArrowRight,
  Loader2,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MONEDAS, MONEDA_POR_DEFECTO, TASA_POR_DEFECTO } from '../../types/usuario';
import toast from 'react-hot-toast';

interface RegisterProps {
  onSuccess?: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSuccess }) => {
  const { register, loginWithGoogle } = useAuth();
  const nav = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [moneda, setMoneda] = useState(MONEDA_POR_DEFECTO);
  const [tasa, setTasa] = useState(String(TASA_POR_DEFECTO));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Password rules validation
  const hasMinLength = password.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const isPasswordValid = hasMinLength;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nombreTrimmed = nombre.trim();
    const emailTrimmed = email.trim().toLowerCase();

    if (!nombreTrimmed || !emailTrimmed || !password.trim()) {
      toast.error('Por favor completá todos los campos obligatorios');
      return;
    }

    if (!hasMinLength) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      toast.error('Ingresá un correo electrónico válido');
      return;
    }

    setLoading(true);
    try {
      await register({
        nombre: nombreTrimmed,
        correo: emailTrimmed,
        password,
        moneda,
        tasa: Number(tasa) || TASA_POR_DEFECTO,
      });

      toast.success('¡Cuenta creada con éxito! Revisá tu correo.');
      if (onSuccess) {
        onSuccess();
      } else {
        nav('/verificar-email');
      }
    } catch (error: unknown) {
      console.error('Error al registrar usuario:', error);
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Este correo ya está registrado. Iniciá sesión con tu contraseña.');
      } else if (err.code === 'auth/weak-password') {
        toast.error('La contraseña es muy débil. Usá al menos 6 caracteres combinando letras y números.');
      } else if (err.code === 'auth/invalid-email') {
        toast.error('El formato del correo electrónico no es válido.');
      } else {
        toast.error(err.message || 'Error al crear la cuenta. Inténtelo nuevamente.');
      }
    } finally {
      setLoading(false);
    }
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
        // Usuario cerró ventana emergente
        return;
      }
      toast.error(err.message || 'Error al registrarte con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const selectedMonedaData = MONEDAS.find((m) => m.codigo === moneda);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="w-full flex flex-col"
    >
      <div className="mb-5 text-left">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Acceso Inmediato</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Creá tu cuenta gratis
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Empezá a gestionar tus suscripciones y servicios en segundos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        {/* Campo Nombre */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
            Nombre completo
          </label>
          <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
            <User className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan Pérez"
              autoComplete="name"
              required
              disabled={loading || googleLoading}
              className="w-full bg-transparent focus:bg-transparent py-3 pr-4 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Campo Correo */}
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
              placeholder="juan@ejemplo.com"
              autoComplete="email"
              required
              disabled={loading || googleLoading}
              className="w-full bg-transparent focus:bg-transparent py-3 pr-4 text-sm font-medium text-slate-100 focus:text-slate-100 caret-cyan-400 placeholder:text-slate-500 focus:outline-none disabled:opacity-50 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Campo Contraseña */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 ml-1">
            Contraseña
          </label>
          <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
            <Lock className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
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

          {/* Indicador de Requisitos de Contraseña */}
          {password.length > 0 && (
            <div className="flex items-center gap-3 mt-2 px-1 text-[11px]">
              <span
                className={`inline-flex items-center gap-1 font-medium transition-colors ${
                  hasMinLength ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <Check className={`w-3 h-3 ${hasMinLength ? 'opacity-100' : 'opacity-30'}`} />
                6+ caracteres
              </span>
              <span
                className={`inline-flex items-center gap-1 font-medium transition-colors ${
                  hasLetter ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <Check className={`w-3 h-3 ${hasLetter ? 'opacity-100' : 'opacity-30'}`} />
                Letras
              </span>
              <span
                className={`inline-flex items-center gap-1 font-medium transition-colors ${
                  hasNumber ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <Check className={`w-3 h-3 ${hasNumber ? 'opacity-100' : 'opacity-30'}`} />
                Números
              </span>
            </div>
          )}
        </div>

        {/* Moneda Preferida */}
        <div>
          <div className="flex items-center justify-between mb-1.5 ml-1 mr-1">
            <label className="text-xs font-medium text-slate-300">
              Moneda de operación
            </label>
            {selectedMonedaData && (
              <span className="text-[11px] text-indigo-300 font-mono">
                {selectedMonedaData.simbolo} {selectedMonedaData.codigo}
              </span>
            )}
          </div>
          <div className="relative flex items-center bg-slate-950/70 border border-slate-800 rounded-2xl transition-all duration-200 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-slate-950/90">
            <Coins className="w-4 h-4 text-slate-500 ml-3.5 mr-2 flex-shrink-0" />
            <select
              value={moneda}
              onChange={(e) => {
                const codigo = e.target.value;
                setMoneda(codigo);
                const sugerida =
                  MONEDAS.find((m) => m.codigo === codigo)?.defTasa ?? TASA_POR_DEFECTO;
                setTasa(String(sugerida));
              }}
              disabled={loading || googleLoading}
              className="w-full bg-transparent focus:bg-transparent py-3 pr-8 text-sm font-medium text-slate-100 focus:text-slate-100 appearance-none focus:outline-none cursor-pointer disabled:opacity-50 [color-scheme:dark]"
            >
              {MONEDAS.map((m) => (
                <option key={m.codigo} value={m.codigo} className="bg-slate-900 text-slate-100">
                  {m.codigo} — {m.pais} ({m.simbolo})
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 ml-1">
            Se usará como moneda base para precios y cálculo de ganancias.
          </p>
        </div>

        {/* Botón Principal Registrarse */}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="mt-2 w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400/30 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creando cuenta...</span>
            </>
          ) : (
            <>
              <span>Crear cuenta gratis</span>
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
              o registrate con
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
      </form>
    </motion.div>
  );
};

export default Register;
