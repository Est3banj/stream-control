import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, collection, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, Link2, Unlink, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TelegramConfig() {
  const { user } = useAuth();
  const [vinculado, setVinculado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [expiraEn, setExpiraEn] = useState(null);

  // Verificar si el usuario ya tiene Telegram vinculado
  useEffect(() => {
    if (!user) return;

    const verificarVinculacion = async () => {
      try {
        const snapshot = await getDocs(
          query(collection(db, 'vinculaciones'), where('uid', '==', user.uid))
        );
        setVinculado(!snapshot.empty);
      } catch (error) {
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
        toast.error('⏰ El código expiró. Generá uno nuevo.');
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
      toast.success('✅ Código generado. Tenés 15 minutos para usarlo.');
    } catch (error) {
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
      toast.success('📋 Código copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar automáticamente');
    }
  };

  const desvincular = async () => {
    if (!user) return;
    setDesvinculando(true);

    try {
      // Buscar la vinculación del usuario
      const snapshot = await getDocs(
        query(collection(db, 'vinculaciones'), where('uid', '==', user.uid))
      );

      const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(promises);

      setVinculado(false);
      toast.success('✅ Telegram desvinculado correctamente');
    } catch (error) {
      console.error('Error desvinculando:', error);
      toast.error('Error al desvincular');
    } finally {
      setDesvinculando(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600">
          Telegram
        </h1>
        <p className="text-gray-600">Conectá tu cuenta de Telegram para recibir notificaciones</p>
      </div>

      {/* Estado actual */}
      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
            vinculado
              ? 'bg-gradient-to-br from-green-500 to-teal-600'
              : 'bg-gradient-to-br from-gray-400 to-gray-500'
          }`}>
            <MessageCircle className="text-white" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {vinculado ? '✅ Conectado' : '❌ No conectado'}
            </h2>
            <p className="text-sm text-gray-500">
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
            className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
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
            <p className="text-sm text-gray-600">
              <b>Pasos para conectar:</b>
            </p>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">1</span>
                <span>Generá un código de vinculación abajo</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">2</span>
                <span>Abrí Telegram y buscá <b>@StreamControlBot</b></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">3</span>
                <span>Enviale el código al bot</span>
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Generar código */}
      {!vinculado && (
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Generar código de vinculación</h3>

          {!codigo ? (
            <button
              onClick={generarCodigo}
              disabled={generando}
              className="btn-primary flex items-center gap-2"
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
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200 text-center">
                <p className="text-sm text-gray-500 mb-2">Tu código de vinculación</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-blue-700 select-all">
                  {codigo}
                </p>
                {expiraEn && (
                  <p className="text-xs text-gray-400 mt-2">
                    Expira en 15 minutos
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copiarCodigo}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {copiado ? (
                    <>
                      <Check size={18} className="text-green-300" />
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

              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <p className="text-xs text-yellow-700">
                  ⚠️ <b>Importante:</b> No compartas este código con nadie más.
                  Solo el bot de Telegram @StreamControlBot debe recibirlo.
                  Después de usarlo o si expira en 15 minutos, dejará de ser válido.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Información adicional */}
      <div className="card bg-gradient-to-r from-gray-50 to-blue-50">
        <h3 className="text-lg font-bold text-gray-900 mb-3">¿Qué notificaciones vas a recibir?</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-3">
            <span className="text-blue-500 mt-0.5">📅</span>
            <span><b>Vencimientos:</b> Cuando un cliente tenga 3, 2 o 1 día(s) antes de vencer</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-blue-500 mt-0.5">💰</span>
            <span><b>Mora:</b> Clientes con saldo pendiente por cobrar</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-blue-500 mt-0.5">🔔</span>
            <span><b>Recordatorios:</b> Resumen diario de clientes por vencer</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
