import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { X, Copy, Check, ExternalLink, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';


// ─── Types ───────────────────────────────────────────────────────────────

interface ServicioTicket {
  plataforma: string;
  correo: string;
  contrasena: string;
  perfil: string;
  pin: string;
  cuentaId: string | null;
  diasRestantes: number | null;
}

interface TokenInfo {
  token: string;
  activo: boolean;
}

interface TicketModalProps {
  cliente: {
    nombre: string;
    telefono?: string;
    id?: string;
  };
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const APP_URL = 'https://streamcontrol-10837.web.app';

function calcularDiasRestantes(fechaVencimiento: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento + 'T00:00:00');
  const diff = venc.getTime() - hoy.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatearDias(d: number): string {
  if (d <= 0) return 'VENCIDO';
  if (d === 1) return '1 día';
  return `${d} días`;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function TicketModal({ cliente, onClose }: TicketModalProps) {
  const { user } = useAuth();
  const [servicios, setServicios] = useState<ServicioTicket[]>([]);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;

    async function cargarDatos(uid: string) {
      try {
        // ── 1. Buscar ventas del cliente ──
        const ventasSnap = await getDocs(
          query(
            collection(db, 'ventas'),
            where('nombre', '==', cliente.nombre),
            where('propietarioId', '==', uid),
          ),
        );

        const serviciosEncontrados: ServicioTicket[] = [];

        for (const vDoc of ventasSnap.docs) {
          const v = vDoc.data() as Record<string, unknown>;

          if (v.servicios && Array.isArray(v.servicios)) {
            // Venta combinada — múltiples servicios (cada uno con su fechaVencimiento)
            for (const s of v.servicios as Array<Record<string, unknown>>) {
              const fechaVenc = (s.fechaVencimiento as string) || (v.fechaVencimiento as string) || '';
              let diasRestantes: number | null = null;
              if (fechaVenc) diasRestantes = calcularDiasRestantes(fechaVenc);

              serviciosEncontrados.push({
                plataforma: (s.plataforma as string) || '',
                correo: (s.correo as string) || '',
                contrasena: (s.contrasena as string) || '',
                perfil: (s.perfilNombre as string) || (s.perfil as string) || '',
                pin: (s.perfilPin as string) || (s.pinPerfil as string) || '',
                cuentaId: (s.cuentaId as string) || null,
                diasRestantes,
              });
            }
          } else {
            // Venta simple
            const fechaVenc = (v.fechaVencimiento as string) || '';
            let diasRestantes: number | null = null;
            if (fechaVenc) diasRestantes = calcularDiasRestantes(fechaVenc);

            serviciosEncontrados.push({
              plataforma: (v.plataforma as string) || '',
              correo: (v.correo as string) || '',
              contrasena: (v.contrasena as string) || '',
              perfil: (v.perfilNombre as string) || (v.perfil as string) || '',
              pin: (v.perfilPin as string) || (v.pinPerfil as string) || '',
              cuentaId: (v.cuentaId as string) || null,
              diasRestantes,
            });
          }
        }

        // Filtrar servicios vencidos (solo mostrar vigentes o sin fecha)
        const vigentes = serviciosEncontrados.filter(
          s => s.diasRestantes === null || s.diasRestantes > 0,
        );
        if (!cancel) setServicios(vigentes);

        // ── 2. Buscar token activo del cliente ──
        const tokensSnap = await getDocs(
          query(
            collection(db, 'tokens'),
            where('clienteNombre', '==', cliente.nombre),
            where('activo', '==', true),
          ),
        );

        if (!tokensSnap.empty) {
          const t = tokensSnap.docs[0].data() as { token?: string; activo?: boolean };
          if (!cancel && t.token) {
            setTokenInfo({ token: t.token, activo: t.activo ?? true });
          }
        }
      } catch (err) {
        console.error('Error cargando datos del ticket:', err);
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    cargarDatos(user.uid);
    return () => { cancel = true; };
  }, [cliente, user]);

  // ── Generar texto plano para copiar ──
  const generarTexto = useCallback((): string => {
    const lineas: string[] = [
      `📋 *Datos de ${cliente.nombre}*`,
      `📞 ${cliente.telefono || '—'}`,
      '',
    ];

    for (let i = 0; i < servicios.length; i++) {
      const s = servicios[i];
      lineas.push(`━━━ Servicio ${i + 1}: ${s.plataforma} ━━━`);
      if (s.correo) lineas.push(`📧 Correo: ${s.correo}`);
      if (s.contrasena) lineas.push(`🔑 Contraseña: ${s.contrasena}`);
      if (s.perfil) lineas.push(`👤 Perfil: ${s.perfil}`);
      if (s.pin) lineas.push(`🔐 PIN: ${s.pin}`);
      if (s.diasRestantes !== null) {
        lineas.push(`⏳ Días restantes: ${formatearDias(s.diasRestantes)}`);
      }
      lineas.push('');
    }

    if (tokenInfo && tokenInfo.activo) {
      lineas.push(`🔗 Código de acceso:`);
      lineas.push(`${APP_URL}/r/${tokenInfo.token}`);
      lineas.push('');
    }

    lineas.push('━━━━━━━━━━━━━━━━━━━━━━');
    lineas.push('Generado por StreamControl');

    return lineas.join('\n');
  }, [cliente, servicios, tokenInfo]);

  const copiarAlPortapapeles = async () => {
    try {
      await navigator.clipboard.writeText(generarTexto());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = generarTexto();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  // ── Render ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">🎫 Ticket: {cliente.nombre}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Cargando datos...</div>
          ) : servicios.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No se encontraron servicios para este cliente.
            </div>
          ) : (
            <>
              {/* Info del cliente */}
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 space-y-0.5">
                <p><span className="font-medium text-gray-800">Cliente:</span> {cliente.nombre}</p>
                {cliente.telefono && (
                  <p><span className="font-medium text-gray-800">Teléfono:</span> {cliente.telefono}</p>
                )}
              </div>

              {/* Servicios */}
              {servicios.map((s, i) => (
                <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-indigo-50 px-4 py-2 font-semibold text-indigo-800 text-sm flex items-center gap-2">
                    <Key size={14} />
                    Servicio {i + 1}: {s.plataforma}
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    {s.correo && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-gray-500 col-span-1">Correo:</span>
                        <span className="font-medium text-gray-800 col-span-2">{s.correo}</span>
                      </div>
                    )}
                    {s.contrasena && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-gray-500 col-span-1">Contraseña:</span>
                        <span className="font-medium text-gray-800 col-span-2 font-mono">{s.contrasena}</span>
                      </div>
                    )}
                    {s.perfil && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-gray-500 col-span-1">Perfil:</span>
                        <span className="font-medium text-gray-800 col-span-2">{s.perfil}</span>
                      </div>
                    )}
                    {s.pin && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-gray-500 col-span-1">PIN:</span>
                        <span className="font-medium text-gray-800 col-span-2 font-mono">{s.pin}</span>
                      </div>
                    )}
                    {s.diasRestantes !== null && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-gray-500 col-span-1">Vence en:</span>
                        <span className={`font-medium col-span-2 ${s.diasRestantes <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatearDias(s.diasRestantes)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Token activo */}
              {tokenInfo && tokenInfo.activo && (
                <div className="border border-blue-200 bg-blue-50 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <ExternalLink size={16} className="text-blue-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-blue-800">Código de acceso activo</p>
                      <a
                        href={`${APP_URL}/r/${tokenInfo.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                      >
                        {APP_URL}/r/{tokenInfo.token}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex gap-2 rounded-b-2xl">
          <button
            onClick={copiarAlPortapapeles}
            disabled={servicios.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-sm"
          >
            {copiado ? <Check size={16} /> : <Copy size={16} />}
            {copiado ? '¡Copiado!' : 'Copiar ticket'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
