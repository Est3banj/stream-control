import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MONEDAS, MONEDA_POR_DEFECTO, TASA_POR_DEFECTO } from '../../types/usuario';

type Modo = 'login' | 'register';

export default function Login(){
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [modo, setModo] = useState<Modo>('login');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
      toast.success('Cuenta creada correctamente. ¡Bienvenido!');
      nav('/');
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

        {modo === 'login' ? (
          /* ═══ FORMULARIO DE INICIO DE SESIÓN ═══ */
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
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
            <button 
              className="btn rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-600 transition-colors duration-500 text-white font-semibold py-4 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="text-center mt-2">
              <button type="button" onClick={toggleModo} className="text-white/70 hover:text-white text-sm transition-colors">
                ¿No tenés cuenta? <span className="font-semibold underline">Crear cuenta</span>
              </button>
            </div>
          </form>
        ) : (
          /* ═══ FORMULARIO DE REGISTRO ═══ */
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
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
              className="btn rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-emerald-600 hover:to-green-600 transition-colors duration-500 text-white font-semibold py-4 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide mt-2"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
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
