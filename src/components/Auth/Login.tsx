import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { callFunction } from '../../lib/apiClient';
import toast from 'react-hot-toast';
import { MONEDAS, MONEDA_POR_DEFECTO, TASA_POR_DEFECTO } from '../../types/usuario';

type Modo = 'login' | 'register';

export default function Login(){
  const { login, register, loginWithGoogle } = useAuth();
  const nav = useNavigate();
  const [modo, setModo] = useState<Modo>('login');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mostrarRecuperacion, setMostrarRecuperacion] = useState(false);
  const [emailRecuperacion, setEmailRecuperacion] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  // Register fields
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regMoneda, setRegMoneda] = useState(MONEDA_POR_DEFECTO);
  const [regTasa, setRegTasa] = useState(String(TASA_POR_DEFECTO));
  const [showRegPassword, setShowRegPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Bienvenido');
      nav('/');
    } catch (error) {
      console.error(error);
      const err = error as { code?: string; message?: string };
      if (err.message?.includes("inactivo")) {
        toast.error("Tu cuenta está inactiva. Contacta al administrador.");
      } else if (err.message?.includes("no registrado")) {
        toast.error("Este usuario no está registrado en la base de datos.");
      } else if (err.message?.includes("Verificá tu correo")) {
        toast.error("Verificá tu correo antes de continuar. Revisá tu bandeja de entrada.");
        nav('/verificar-email');
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        toast.error("Correo o contraseña incorrectos.");
      } else {
        toast.error("Error al iniciar sesión. Inténtelo nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!regNombre.trim() || !regEmail.trim() || !regPassword.trim()) {
      toast.error('Todos los campos son obligatorios');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await register({
        nombre: regNombre.trim(),
        correo: regEmail.trim(),
        password: regPassword,
        moneda: regMoneda,
        tasa: Number(regTasa) || TASA_POR_DEFECTO,
      });
      toast.success('Cuenta creada. Revisá tu correo para verificar tu cuenta.');
      nav('/verificar-email');
    } catch (error) {
      console.error(error);
      const err = error as { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Este correo ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        toast.error('La contraseña es muy débil.');
      } else {
        toast.error('Error al crear la cuenta. Inténtelo nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRecuperacion.trim()) {
      toast.error('Ingresá tu correo electrónico');
      return;
    }
    setRecuperando(true);
    try {
      await callFunction('enviarCorreoRecuperacion', { email: emailRecuperacion.trim() });
      setEnviado(true);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'functions/resource-exhausted') {
        toast.error('Esperá un minuto antes de solicitar otro correo');
      } else {
        toast.error(error.message || 'Error al enviar el correo');
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
      setLoading(true);
      await loginWithGoogle();
      toast.success('Bienvenido');
      nav('/');
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || 'Error al iniciar sesion con Google');
    } finally {
      setLoading(false);
    }
  };

  const toggleModo = () => {
    setModo(modo === 'login' ? 'register' : 'login');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-gradient-to-tr from-indigo-900 via-indigo-800 to-violet-900 overflow-hidden px-4 font-sans">
      <svg className="absolute bottom-0 left-0 w-full h-48 md:h-64 opacity-30 animate-wave" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="url(#gradient)" fillOpacity="0.7" d="M0,64L48,80C96,96,192,128,288,160C384,192,480,224,576,213.3C672,203,768,149,864,117.3C960,85,1056,75,1152,90.7C1248,107,1344,149,1392,170.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7e3ff2" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10 w-full max-w-md bg-white bg-opacity-15 backdrop-blur-lg rounded-3xl shadow-2xl p-10 animate-fadeInUp transition-all duration-700 ease-in-out">
        <div className="flex justify-center mb-6">
          <div className="w-32 h-32 md:w-36 md:h-36 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center p-3 shadow-lg">
            <img 
              src="/stream.webp" 
              alt="StreamControl Pro"
              className="w-full h-full object-contain drop-shadow-2xl animate-fadeInUp"
              style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
            />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold mb-8 text-white drop-shadow-lg text-center tracking-wide">StreamControl Pro</h2>

        {modo === 'login' && !mostrarRecuperacion ? (
          /* ═══ FORMULARIO DE INICIO DE SESIÓN ═══ */
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="Correo" 
              className="rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500 transition-shadow duration-500 bg-white bg-opacity-70 text-gray-900 shadow-md placeholder-gray-500 text-lg font-medium animate-inputFade"
              autoComplete="email"
            />
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Contraseña" 
                className="rounded-2xl w-full pr-24 px-5 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500 transition-shadow duration-500 bg-white bg-opacity-70 text-gray-900 shadow-md placeholder-gray-500 text-lg font-medium animate-inputFade"
                autoComplete="current-password"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-indigo-400 hover:text-indigo-600 font-semibold transition-colors duration-300 select-none text-sm md:text-base"
                tabIndex={-1}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="text-right -mt-4">
              <button
                type="button"
                onClick={abrirRecuperacion}
                className="text-white/60 hover:text-white text-xs transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <button 
              className="btn rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-600 transition-colors duration-500 text-white font-semibold py-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-transparent text-white/40">o continua con</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/20 font-semibold py-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide flex items-center justify-center gap-3 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>

            <div className="text-center mt-2">
              <button type="button" onClick={toggleModo} className="text-white/70 hover:text-white text-sm transition-colors">
                ¿No tenés cuenta? <span className="font-semibold underline">Crear cuenta</span>
              </button>
            </div>
          </form>
        ) : modo === 'login' && mostrarRecuperacion ? (
          /* ═══ RECUPERAR CONTRASEÑA ═══ */
          <div className="flex flex-col gap-3 animate-fadeInUp">
            {!enviado ? (
              <form onSubmit={handleRecuperar} className="flex flex-col gap-3">
                <div className="text-center mb-2">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">¿Olvidaste tu contraseña?</h3>
                  <p className="text-sm text-white/60">Ingresá tu correo y te enviaremos un enlace para restablecerla.</p>
                </div>
                <input
                  type="email"
                  value={emailRecuperacion}
                  onChange={e => setEmailRecuperacion(e.target.value)}
                  placeholder="Tu correo electrónico"
                  className="rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500 transition-shadow duration-500 bg-white bg-opacity-70 text-gray-900 shadow-md placeholder-gray-500 text-lg font-medium"
                  autoComplete="email"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={recuperando}
                  className="btn rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-600 transition-colors duration-500 text-white font-semibold py-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide mt-2"
                >
                  {recuperando ? 'Enviando...' : 'Enviar enlace'}
                </button>
                <div className="text-center mt-2">
                  <button type="button" onClick={cerrarRecuperacion} className="text-white/60 hover:text-white text-sm transition-colors">
                    Volver al inicio de sesión
                  </button>
                </div>
              </form>
            ) : (
              /* ═══ CONFIRMACIÓN DE ENVÍO ═══ */
              <div className="flex flex-col gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Correo enviado</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Te enviamos un enlace a <strong className="text-white">{emailRecuperacion}</strong>.
                  Revisá tu bandeja de entrada y segui las instrucciones para restablecer tu contraseña.
                </p>
                <div className="bg-white/10 rounded-xl px-4 py-3 text-left">
                  <p className="text-xs text-white/50">
                    <strong className="text-white/70">¿No lo recibiste?</strong> Revisá la carpeta de
                    spam o correo no deseado. Si pasaron varios minutos y no llega, intentá de nuevo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cerrarRecuperacion}
                  className="btn rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/20 font-semibold py-3 transition-colors text-base mt-2"
                >
                  Volver al inicio de sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ═══ FORMULARIO DE REGISTRO ═══ */
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <input 
              type="text"
              value={regNombre} 
              onChange={e => setRegNombre(e.target.value)} 
              placeholder="Nombre completo" 
              className="rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500 transition-shadow duration-500 bg-white bg-opacity-70 text-gray-900 shadow-md placeholder-gray-500 text-lg font-medium animate-inputFade"
              autoComplete="name"
            />
            <input 
              type="email"
              value={regEmail} 
              onChange={e => setRegEmail(e.target.value)} 
              placeholder="Correo electrónico" 
              className="rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500 transition-shadow duration-500 bg-white bg-opacity-70 text-gray-900 shadow-md placeholder-gray-500 text-lg font-medium animate-inputFade"
              autoComplete="email"
            />
            <div className="relative">
              <input 
                type={showRegPassword ? 'text' : 'password'} 
                value={regPassword} 
                onChange={e => setRegPassword(e.target.value)} 
                placeholder="Contraseña (mín. 6 caracteres)" 
                className="rounded-2xl w-full pr-24 px-5 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500 transition-shadow duration-500 bg-white bg-opacity-70 text-gray-900 shadow-md placeholder-gray-500 text-lg font-medium animate-inputFade"
                autoComplete="new-password"
              />
              <button 
                type="button" 
                onClick={() => setShowRegPassword(!showRegPassword)} 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-indigo-400 hover:text-indigo-600 font-semibold transition-colors duration-300 select-none text-sm md:text-base"
                tabIndex={-1}
              >
                {showRegPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {/* Moneda */}
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-1 ml-1">Moneda</label>
              <select
                value={regMoneda}
                onChange={e => {
                  const codigo = e.target.value;
                  setRegMoneda(codigo);
                  const sugerida = MONEDAS.find(m => m.codigo === codigo)?.defTasa ?? TASA_POR_DEFECTO;
                  setRegTasa(String(sugerida));
                }}
                className="rounded-2xl w-full px-5 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500 transition-shadow duration-500 bg-white bg-opacity-70 text-gray-900 shadow-md text-lg font-medium"
              >
                {MONEDAS.map(m => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.codigo} — {m.pais} ({m.simbolo})
                  </option>
                ))}
              </select>
              <p className="text-xs text-white/50 mt-1 ml-1">
                Los precios de los planes se mostrarán en esta moneda
              </p>
            </div>

            <button 
              className="btn rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-emerald-600 hover:to-green-600 transition-colors duration-500 text-white font-semibold py-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide mt-2"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-transparent text-white/40">o registrate con</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn rounded-2xl bg-white/10 border border-white/20 text-white hover:bg-white/20 font-semibold py-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide flex items-center justify-center gap-3 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>

            <div className="text-center mt-1">
              <button type="button" onClick={toggleModo} className="text-white/70 hover:text-white text-sm transition-colors">
                ¿Ya tenés cuenta? <span className="font-semibold underline">Iniciar sesión</span>
              </button>
            </div>
          </form>
        )}
      </div>
      <footer className="relative z-10 mt-8 text-white text-sm opacity-90 select-none font-light tracking-wide text-center">
        © StreamControl 2025 — Todos los derechos reservados
      </footer>

      <style>{`
        @keyframes wave {
          0% { transform: translateX(0); }
          50% { transform: translateX(-25%); }
          100% { transform: translateX(0); }
        }
        .animate-wave {
          animation: wave 15s ease-in-out infinite;
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.8s ease forwards;
        }
        @keyframes inputFade {
          0% { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .animate-inputFade {
          animation: inputFade 0.7s ease forwards;
        }
        @media (max-width: 640px) {
          .btn {
            font-size: 1rem;
            padding: 1rem 0;
          }
          input, select {
            font-size: 1rem;
            padding: 1rem 1.25rem;
          }
        }
      `}</style>
    </div>
  )
}
