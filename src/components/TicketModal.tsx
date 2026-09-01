import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { X, Copy, Check, ExternalLink, Key, Ticket, User, Lock, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { Cuenta } from '../types/cuenta';

// ─── Types ───────────────────────────────────────────────────────────────

export interface PerfilTicket {
  nombre: string;
  pin?: string;
}

export interface ServicioTicket {
  plataforma: string;
  correo: string;
  contrasena: string;
  perfiles: PerfilTicket[];
  fechaInicio?: string;
  fechaVencimiento?: string;
  diasRestantes: number | null;
  cuentaId?: string | null;
  notas?: string;
}

export interface TokenInfo {
  token: string;
  activo: boolean;
}

export interface TicketModalProps {
  cliente: {
    nombre: string;
    telefono?: string;
    id?: string;
    plataforma?: string;
    correo?: string;
    fechaVencimiento?: string;
    cuentaId?: string;
    perfilAsignado?: string;
  };
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const APP_URL = typeof window !== 'undefined' ? window.location.origin : '';

function calcularDiasRestantes(fechaVencimiento: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento + 'T00:00:00');
  const diff = venc.getTime() - hoy.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatearDias(d: number): string {
  if (d <= 0) return 'Vencido';
  if (d === 1) return '1 día restante';
  return `${d} días restantes`;
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
        // ── 1. Cuentas cache para resolver cuentaId ──
        const cuentasMap = new Map<string, Cuenta>();
        const cuentasSnap = await getDocs(
          query(collection(db, 'cuentas'), where('propietarioId', '==', uid))
        );
        cuentasSnap.docs.forEach(docSnap => {
          cuentasMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Cuenta);
        });

        // ── 2. Buscar ventas del cliente ──
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

          if (v.servicios && Array.isArray(v.servicios) && v.servicios.length > 0) {
            // Venta combinada — múltiples servicios
            for (const s of v.servicios as Array<Record<string, unknown>>) {
              const cuentaId = (s.cuentaId as string) || null;
              const cuenta = cuentaId ? cuentasMap.get(cuentaId) : undefined;

              const fechaVenc = (s.fechaVencimiento as string) || (v.fechaVencimiento as string) || '';
              let diasRestantes: number | null = null;
              if (fechaVenc) diasRestantes = calcularDiasRestantes(fechaVenc);

              const correo = (s.correo as string) || (s.correoCuenta as string) || cuenta?.correoCuenta || '';
              const contrasena = (s.contrasena as string) || '';

              // Extraer perfiles
              const perfiles: PerfilTicket[] = [];
              if (Array.isArray(s.perfiles)) {
                for (const p of s.perfiles as Array<Record<string, string>>) {
                  if (p && (p.nombre || p.pin)) {
                    perfiles.push({ nombre: p.nombre || '', pin: p.pin || '' });
                  }
                }
              }

              const singlePerfilNombre = (s.perfilNombre as string) || (s.perfil as string);
              const singlePerfilPin = (s.perfilPin as string) || (s.pinPerfil as string) || '';
              if (singlePerfilNombre && !perfiles.some(p => p.nombre === singlePerfilNombre)) {
                perfiles.push({ nombre: singlePerfilNombre, pin: singlePerfilPin });
              }

              // Si tiene cuenta vinculada, enriquecer con PINs o perfiles asignados
              if (cuenta && Array.isArray(cuenta.perfiles)) {
                // Completar PINs faltantes
                perfiles.forEach(p => {
                  if (!p.pin) {
                    const match = cuenta.perfiles?.find(cp => cp.nombre === p.nombre);
                    if (match?.pin) p.pin = match.pin;
                  }
                });

                // Si no hay perfiles en la venta, buscar los asignados al cliente en la cuenta
                if (perfiles.length === 0) {
                  cuenta.perfiles
                    .filter(cp => cp.clienteNombre === cliente.nombre)
                    .forEach(cp => perfiles.push({ nombre: cp.nombre, pin: cp.pin || '' }));
                }
              }

              serviciosEncontrados.push({
                plataforma: (s.plataforma as string) || (v.plataforma as string) || 'Servicio',
                correo,
                contrasena,
                perfiles,
                fechaInicio: (s.fechaInicio as string) || (v.fechaInicio as string) || undefined,
                fechaVencimiento: fechaVenc || undefined,
                diasRestantes,
                cuentaId,
                notas: (s.notas as string) || (v.notas as string) || undefined,
              });
            }
          } else {
            // Venta simple
            const cuentaId = (v.cuentaId as string) || null;
            const cuenta = cuentaId ? cuentasMap.get(cuentaId) : undefined;

            const fechaVenc = (v.fechaVencimiento as string) || '';
            let diasRestantes: number | null = null;
            if (fechaVenc) diasRestantes = calcularDiasRestantes(fechaVenc);

            const correo = (v.correo as string) || (v.correoCuenta as string) || cuenta?.correoCuenta || '';
            const contrasena = (v.contrasena as string) || '';

            // Extraer perfiles
            const perfiles: PerfilTicket[] = [];
            if (Array.isArray(v.perfiles)) {
              for (const p of v.perfiles as Array<Record<string, string>>) {
                if (p && (p.nombre || p.pin)) {
                  perfiles.push({ nombre: p.nombre || '', pin: p.pin || '' });
                }
              }
            }

            const singlePerfilNombre = (v.perfilNombre as string) || (v.perfil as string);
            const singlePerfilPin = (v.perfilPin as string) || (v.pinPerfil as string) || '';
            if (singlePerfilNombre && !perfiles.some(p => p.nombre === singlePerfilNombre)) {
              perfiles.push({ nombre: singlePerfilNombre, pin: singlePerfilPin });
            }

            // Enriquecer con cuenta si aplica
            if (cuenta && Array.isArray(cuenta.perfiles)) {
              perfiles.forEach(p => {
                if (!p.pin) {
                  const match = cuenta.perfiles?.find(cp => cp.nombre === p.nombre);
                  if (match?.pin) p.pin = match.pin;
                }
              });

              if (perfiles.length === 0) {
                cuenta.perfiles
                  .filter(cp => cp.clienteNombre === cliente.nombre)
                  .forEach(cp => perfiles.push({ nombre: cp.nombre, pin: cp.pin || '' }));
              }
            }

            serviciosEncontrados.push({
              plataforma: (v.plataforma as string) || 'Servicio',
              correo,
              contrasena,
              perfiles,
              fechaInicio: (v.fechaInicio as string) || undefined,
              fechaVencimiento: fechaVenc || undefined,
              diasRestantes,
              cuentaId,
              notas: (v.notas as string) || undefined,
            });
          }
        }

        // Fallback: si no hay ventas pero el cliente tiene plataforma asignada
        if (serviciosEncontrados.length === 0 && cliente.plataforma) {
          const cuenta = cliente.cuentaId ? cuentasMap.get(cliente.cuentaId) : undefined;
          const perfiles: PerfilTicket[] = [];
          if (cliente.perfilAsignado) {
            const match = cuenta?.perfiles?.find(cp => cp.nombre === cliente.perfilAsignado);
            perfiles.push({ nombre: cliente.perfilAsignado, pin: match?.pin || '' });
          } else if (cuenta && Array.isArray(cuenta.perfiles)) {
            cuenta.perfiles
              .filter(cp => cp.clienteNombre === cliente.nombre)
              .forEach(cp => perfiles.push({ nombre: cp.nombre, pin: cp.pin || '' }));
          }

          const fechaVenc = cliente.fechaVencimiento || '';
          let diasRestantes: number | null = null;
          if (fechaVenc) diasRestantes = calcularDiasRestantes(fechaVenc);

          serviciosEncontrados.push({
            plataforma: cliente.plataforma,
            correo: cliente.correo || cuenta?.correoCuenta || '',
            contrasena: '',
            perfiles,
            fechaVencimiento: fechaVenc || undefined,
            diasRestantes,
            cuentaId: cliente.cuentaId || null,
          });
        }

        // Filtrar servicios vencidos si existen vigentes, o mantener todos si todos vencieron
        const vigentes = serviciosEncontrados.filter(
          s => s.diasRestantes === null || s.diasRestantes > 0,
        );
        if (!cancel) setServicios(vigentes.length > 0 ? vigentes : serviciosEncontrados);

        // ── 3. Buscar token activo del cliente ──
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

  // ── Generar texto plano para WhatsApp y portapapeles ──
  const generarTexto = useCallback((): string => {
    const lineas: string[] = [
      `📋 *Datos de Acceso - ${cliente.nombre}*`,
    ];
    if (cliente.telefono) {
      lineas.push(`📞 ${cliente.telefono}`);
    }
    lineas.push('');

    servicios.forEach((s, idx) => {
      lineas.push(`━━━ Servicio ${idx + 1}: ${s.plataforma} ━━━`);
      if (s.correo) lineas.push(`📧 Correo: ${s.correo}`);
      if (s.contrasena) lineas.push(`🔑 Contraseña: ${s.contrasena}`);

      if (s.perfiles && s.perfiles.length > 0) {
        if (s.perfiles.length === 1) {
          lineas.push(`👤 Perfil: ${s.perfiles[0].nombre}`);
          if (s.perfiles[0].pin) {
            lineas.push(`🔐 PIN: ${s.perfiles[0].pin}`);
          }
        } else {
          lineas.push('👤 Perfiles:');
          s.perfiles.forEach(p => {
            const pinStr = p.pin ? ` (PIN: ${p.pin})` : '';
            lineas.push(`  • ${p.nombre}${pinStr}`);
          });
        }
      }

      if (s.fechaVencimiento) {
        const diasStr = s.diasRestantes !== null ? ` (${formatearDias(s.diasRestantes)})` : '';
        lineas.push(`⏳ Vencimiento: ${s.fechaVencimiento}${diasStr}`);
      } else if (s.diasRestantes !== null) {
        lineas.push(`⏳ Días restantes: ${formatearDias(s.diasRestantes)}`);
      }

      if (s.notas) {
        lineas.push(`📝 Notas: ${s.notas}`);
      }

      lineas.push('');
    });

    if (tokenInfo && tokenInfo.activo) {
      lineas.push('🔗 Código de acceso:');
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
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-slate-100 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-5 py-3.5 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Ticket size={18} className="text-cyan-400" />
            <span>Ticket de Entrega: {cliente.nombre}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Cargando datos del ticket...</div>
          ) : servicios.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No se encontraron servicios registrados para este cliente.
            </div>
          ) : (
            <>
              {/* Info del cliente */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-sm text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Cliente</span>
                  <span className="text-slate-100 font-semibold">{cliente.nombre}</span>
                </div>
                {cliente.telefono && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Teléfono</span>
                    <span className="text-slate-200 font-mono">{cliente.telefono}</span>
                  </div>
                )}
              </div>

              {/* Servicios */}
              {servicios.map((s, i) => (
                <div key={i} className="border border-slate-800 rounded-xl bg-slate-950/40 overflow-hidden shadow-sm">
                  <div className="bg-indigo-950/50 px-4 py-2.5 font-semibold text-indigo-300 border-b border-indigo-900/40 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key size={14} className="text-indigo-400" />
                      <span>{s.plataforma}</span>
                    </div>
                    {s.fechaVencimiento && (
                      <span className="text-xs text-slate-400 font-normal">
                        Vence: {s.fechaVencimiento}
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    {s.correo && (
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Correo</span>
                        <p className="text-sm font-medium text-slate-100 mt-0.5 select-all font-mono break-all">{s.correo}</p>
                      </div>
                    )}
                    {s.contrasena && (
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contraseña</span>
                        <p className="text-sm font-medium text-amber-400 mt-0.5 select-all font-mono">{s.contrasena}</p>
                      </div>
                    )}

                    {/* Perfiles y PINs */}
                    {s.perfiles && s.perfiles.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
                          {s.perfiles.length > 1 ? 'Perfiles Asignados' : 'Perfil Asignado'}
                        </span>
                        <div className="space-y-1.5">
                          {s.perfiles.map((p, pIdx) => (
                            <div key={pIdx} className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl">
                              <div className="flex items-center gap-2">
                                <User size={14} className="text-cyan-400" />
                                <span className="text-sm font-medium text-slate-200">{p.nombre}</span>
                              </div>
                              {p.pin && (
                                <div className="flex items-center gap-1.5 bg-indigo-950/60 border border-indigo-800/50 px-2 py-0.5 rounded-lg text-xs font-mono text-cyan-300">
                                  <Lock size={12} className="text-indigo-400" />
                                  <span>PIN: {p.pin}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vencimiento */}
                    {s.diasRestantes !== null && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                        <span className="text-slate-400">Estado de vigencia:</span>
                        <span className={`font-semibold px-2 py-0.5 rounded-full border ${
                          s.diasRestantes <= 3
                            ? 'bg-rose-950/50 text-rose-400 border-rose-800/40'
                            : 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
                        }`}>
                          {formatearDias(s.diasRestantes)}
                        </span>
                      </div>
                    )}

                    {/* Notas */}
                    {s.notas && (
                      <div className="pt-2 border-t border-slate-800/60">
                        <div className="flex items-center gap-1 text-xs text-slate-400 font-semibold mb-0.5">
                          <FileText size={12} />
                          <span>Notas / Instrucciones:</span>
                        </div>
                        <p className="text-xs text-slate-300 italic">{s.notas}</p>
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
                      <p className="text-sm font-medium text-cyan-300">Portal de consulta de códigos</p>
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
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-5 py-3.5 flex gap-2 rounded-b-2xl z-10">
          <button
            onClick={copiarAlPortapapeles}
            disabled={servicios.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg shadow-indigo-950/50"
          >
            {copiado ? <Check size={16} /> : <Copy size={16} />}
            {copiado ? '¡Ticket copiado!' : 'Copiar ticket WhatsApp'}
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
