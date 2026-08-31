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

const APP_URL = window.location.origin;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎫</span> Ticket: {cliente.nombre}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Cargando datos...</div>
          ) : servicios.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No se encontraron servicios para este cliente.
            </div>
          ) : (
            <>
              {/* Info del cliente */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-sm text-slate-300 space-y-0.5">
                <p><span className="font-medium text-slate-400">Cliente:</span> <span className="text-slate-100 font-semibold">{cliente.nombre}</span></p>
                {cliente.telefono && (
                  <p><span className="font-medium text-slate-400">Teléfono:</span> <span className="text-slate-200">{cliente.telefono}</span></p>
                )}
              </div>

              {/* Servicios */}
              {servicios.map((s, i) => (
                <div key={i} className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden">
                  <div className="bg-indigo-950/50 px-4 py-2 font-semibold text-indigo-300 border-b border-indigo-900/40 text-sm flex items-center gap-2">
                    <Key size={14} />
                    Servicio {i + 1}: {s.plataforma}
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    {s.correo && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-400 col-span-1">Correo:</span>
                        <span className="font-medium text-slate-200 col-span-2">{s.correo}</span>
                      </div>
                    )}
                    {s.contrasena && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-400 col-span-1">Contraseña:</span>
                        <span className="font-medium text-slate-200 col-span-2 font-mono">{s.contrasena}</span>
                      </div>
                    )}
                    {s.perfil && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-400 col-span-1">Perfil:</span>
                        <span className="font-medium text-slate-200 col-span-2">{s.perfil}</span>
                      </div>
                    )}
                    {s.pin && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-400 col-span-1">PIN:</span>
                        <span className="font-medium text-slate-200 col-span-2 font-mono">{s.pin}</span>
                      </div>
                    )}
                    {s.diasRestantes !== null && (
                      <div className="grid grid-cols-3 gap-1">
                        <span className="text-slate-400 col-span-1">Vence en:</span>
                        <span className={`font-medium col-span-2 ${s.diasRestantes <= 3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {formatearDias(s.diasRestantes)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Token activo */}
              {tokenInfo && tokenInfo.activo && (
                <div className="border border-cyan-800/40 bg-cyan-950/30 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <ExternalLink size={16} className="text-cyan-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-cyan-300">Código de acceso activo</p>
                      <a
                        href={`${APP_URL}/r/${tokenInfo.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cyan-400 hover:text-cyan-300 underline break-all font-mono"
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
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 px-5 py-3.5 flex gap-2 rounded-b-2xl z-10">
          <button
            onClick={copiarAlPortapapeles}
            disabled={servicios.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm"
          >
            {copiado ? <Check size={16} /> : <Copy size={16} />}
            {copiado ? '¡Copiado!' : 'Copiar ticket'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 btn-secondary text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
