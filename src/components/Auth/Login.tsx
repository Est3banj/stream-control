import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login(){
  const { login } = useAuth();
  const nav = useNavigate();
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await login(email, password);
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-gradient-to-tr from-indigo-900 via-purple-900 to-pink-900 overflow-hidden px-4 font-sans">
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
          <img 
            src="/stream.webp" 
            alt="StreamControl Pro"
            className="w-28 h-28 md:w-32 md:h-32 object-contain drop-shadow-2xl animate-fadeInUp"
            style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
          />
        </div>
        <h2 className="text-3xl font-extrabold mb-8 text-white drop-shadow-lg text-center tracking-wide">StreamControl Pro</h2>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <input 
            type="email"
            value={email} 
            onChange={e=>setEmail(e.target.value)} 
            placeholder="Correo" 
            className="rounded-2xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-indigo-500 transition-shadow duration-500 bg-white bg-opacity-70 text-gray-900 shadow-md placeholder-gray-500 text-lg font-medium animate-inputFade"
            autoComplete="email"
          />
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
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
            className="btn rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-purple-600 hover:to-indigo-600 transition-colors duration-500 text-white font-semibold py-4 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg tracking-wide"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
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
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.8s ease forwards;
        }
        @keyframes inputFade {
          0% {
            opacity: 0;
            transform: translateX(-10px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-inputFade {
          animation: inputFade 0.7s ease forwards;
        }
        @media (max-width: 640px) {
          .btn {
            font-size: 1rem;
            padding: 1rem 0;
          }
          input {
            font-size: 1rem;
            padding: 1rem 1.25rem;
          }
        }
      `}</style>
    </div>
  )
}
