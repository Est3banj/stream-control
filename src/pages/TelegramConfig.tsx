import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, collection, Timestamp, query, where, getDocs, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { callFunction } from '../lib/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, Link2, Unlink, Copy, Check, RefreshCw, ExternalLink, Calendar, DollarSign, Bell, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import usePermisos from '../hooks/usePermisos';
import FeatureBlocked from '../components/FeatureBlocked';

export default function TelegramConfig() {
  const { user } = useAuth();
  const permisos = usePermisos(user);

  if (!permisos.puedeUsarTelegram) {
    return (
      <div className="space-y-6 animate-fade-in text-slate-100">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            Telegram
          </h1>
          <p className="text-slate-400">Recibí notificaciones de vencimientos en tu Telegram</p>
        </div>
        <FeatureBlocked
          feature="Notificaciones Telegram"
          description="Recibí alertas automáticas cuando un cliente esté por vencer, directamente en tu Telegram."
          plan="Professional y Enterprise"
        />
      </div>
    );
  }

  return <TelegramConfigContent user={user} />;
}

function TelegramConfigContent({ user }: { user: ReturnType<typeof useAuth>['user'] }) {
  const [vinculado, setVinculado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [expiraEn, setExpiraEn] = useState<number | null>(null);

  // Verificar si el usuario ya tiene Telegram vinculado
  useEffect(() => {
    if (!user) return;

    const verificarVinculacion = async () => {
      try {
        const snapshot: QuerySnapshot<DocumentData> = await getDocs(
          query(collection(db, 'vinculaciones'), where('uid', '==', user.uid))
        );
        setVinculado(!snapshot.empty);
      } catch (error: unknown) {
        // Si la colección no existe o no hay permisos, asumir no vinculado
        console.log('Error verificando vinculación:', error);
        setVinculado(false);
      }
    };

    verificarVinculacion();
  }, [user]);

  // Temporizador para la expiración del código
  useEffect(() => {
    if (!expiraEn) return;

    const interval = setInterval(() => {
      const ahora = Date.now();
      const restante = expiraEn - ahora;

      if (restante <= 0) {
        setCodigo('');
        setExpiraEn(null);
        toast.error('El código expiró. Generá uno nuevo.');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiraEn]);

  const generarCodigo = async () => {
    if (!user) return;
    setGenerando(true);

    try {
      // Llamar a la Cloud Function o escribir directamente
      // Por ahora usamos escritura directa con crypto
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      const array = new Uint8Array(8);
      crypto.getRandomValues(array);
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[array[i] % chars.length];
      }

      const ahora = Timestamp.now();
      const expira = new Date(ahora.toMillis() + 15 * 60 * 1000);

      await setDoc(doc(db, 'codigosVinculacion', code), {
        uid: user.uid,
        createdAt: ahora,
        expiresAt: Timestamp.fromDate(expira),
        expirado: false,
      });

      setCodigo(code);
      setExpiraEn(expira.getTime());
      setCopiado(false);
      toast.success('Código generado. Tenés 15 minutos para usarlo.');
    } catch (error: unknown) {
      console.error('Error generando código:', error);
      toast.error('Error al generar el código. Verificá los permisos de Firestore.');
    } finally {
      setGenerando(false);
    }
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success('Código copiado al portapapeles');
    } catch (error: unknown) {
      toast.error('No se pudo copiar automáticamente');
    }
  };

  const desvincular = async () => {
    if (!user) return;
    setDesvinculando(true);

    try {
      const data = await callFunction<Record<string, never>, { success: boolean; alreadyUnlinked?: boolean }>('desvincularTelegram');

      setVinculado(false);

      if (data.alreadyUnlinked) {
        toast('Ya estaba desvinculado');
      } else {
        toast.success('Telegram desvinculado correctamente');
      }
    } catch (error: unknown) {
      console.error('Error desvinculando:', error);
      const err = error as { code?: string; message?: string };
      if (err.code === 'functions/unauthenticated') {
        toast.error('Sesión expirada. Iniciá sesión de nuevo.');
      } else {
        toast.error('Error de conexión. Intentá de nuevo.');
      }
    } finally {
      setDesvinculando(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
          Telegram
        </h1>
        <p className="text-slate-400">Conectá tu cuenta de Telegram para recibir notificaciones</p>
      </div>

      {/* Estado actual */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
            vinculado
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-950/50'
              : 'bg-slate-800 border border-slate-700 text-slate-400'
          }`}>
            <MessageCircle className="text-white" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {vinculado ? 'Conectado' : 'No conectado'}
            </h2>
            <p className="text-sm text-slate-400">
              {vinculado
                ? 'Recibís notificaciones de vencimientos y mora por Telegram'
                : 'Activá las notificaciones para no perderte ningún vencimiento'}
            </p>
          </div>
        </div>

        {vinculado ? (
          <button
            onClick={desvincular}
            disabled={desvinculando}
            className="btn-secondary flex items-center gap-2 text-rose-400 hover:text-rose-300 border-rose-800/40 hover:bg-rose-950/40"
          >
            {desvinculando ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Unlink size={18} />
            )}
            {desvinculando ? 'Desvinculando...' : 'Desvincular Telegram'}
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 font-semibold">
              Pasos para conectar:
            </p>
            <ol className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-950/80 border border-indigo-800/40 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
                <span>Generá un código de vinculación abajo</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-950/80 border border-indigo-800/40 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
                <span>Abrí Telegram y buscá <b className="text-white">@NotiStream_bot</b></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-950/80 border border-indigo-800/40 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
                <span>Enviale el código al bot</span>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Generar código */}
      {!vinculado && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Generar código de vinculación</h3>

          {!codigo ? (
            <button
              onClick={generarCodigo}
              disabled={generando}
              className="btn-primary flex items-center gap-2 shadow-lg shadow-indigo-950/50"
            >
              {generando ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Link2 size={18} />
              )}
              {generando ? 'Generando...' : 'Generar código'}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-indigo-950/40 rounded-2xl p-6 border border-indigo-800/40 text-center">
                <p className="text-sm text-slate-400 mb-2">Tu código de vinculación</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-cyan-300 select-all">
                  {codigo}
                </p>
                {expiraEn && (
                  <p className="text-xs text-slate-400 mt-2">
                    Expira en 15 minutos
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copiarCodigo}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
                >
                  {copiado ? (
                    <>
                      <Check size={18} className="text-emerald-400" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copiar código
                    </>
                  )}
                </button>

                <button
                  onClick={generarCodigo}
                  disabled={generando}
                  className="btn-secondary flex items-center gap-2"
                  title="Generar nuevo código"
                >
                  <RefreshCw size={18} className={generando ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="bg-amber-950/30 rounded-xl p-4 border border-amber-800/40 flex items-start gap-2.5">
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-amber-300">
                  <b>Importante:</b> No compartas este código con nadie más.
                  Solo el bot de Telegram @NotiStream_bot debe recibirlo.
                  Después de usarlo o si expira en 15 minutos, dejará de ser válido.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl p-6">
        <h3 className="text-lg font-bold text-white mb-3">¿Qué notificaciones vas a recibir?</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-indigo-400 mt-0.5"><Calendar size={16} /></span>
            <span><b className="text-white">Vencimientos:</b> Cuando un cliente tenga 3, 2 o 1 día(s) antes de vencer</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-emerald-400 mt-0.5"><DollarSign size={16} /></span>
            <span><b className="text-white">Mora:</b> Clientes con saldo pendiente por cobrar</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-cyan-400 mt-0.5"><Bell size={16} /></span>
            <span><b className="text-white">Recordatorios:</b> Resumen diario de clientes por vencer</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
