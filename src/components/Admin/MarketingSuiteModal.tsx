import React, { useState } from 'react';
import {
  Megaphone,
  Flame,
  Clock,
  Sparkles,
  Send,
  X,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Bell,
  LayoutTemplate,
  Users,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { callFunction } from '../../lib/apiClient';
import { useAdminConfig, sanitizarWhatsApp, getWhatsAppSupportNumber } from '../../hooks/useAdminConfig';
import toast from 'react-hot-toast';

export interface MarketingSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  bannerActivo?: boolean;
  onClearBanner?: () => Promise<void>;
}

export type TipoAlerta = 'comunicado' | 'promocion' | 'vencimiento' | 'novedad';
export type SegmentoAudiencia = 'todos' | 'activos' | 'por_vencer';

export default function MarketingSuiteModal({
  isOpen,
  onClose,
  onSuccess,
  bannerActivo = false,
  onClearBanner,
}: MarketingSuiteModalProps) {
  const { config } = useAdminConfig();

  const [tipo, setTipo] = useState<TipoAlerta>('comunicado');
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [linkBoton, setLinkBoton] = useState('');
  const [textoBoton, setTextoBoton] = useState('');
  const [segmento, setSegmento] = useState<SegmentoAudiencia>('todos');

  // Canales de difusión
  const [canalInApp, setCanalInApp] = useState(true);
  const [canalBanner, setCanalBanner] = useState(false);
  const [canalEmail, setCanalEmail] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [desactivandoBanner, setDesactivandoBanner] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [previewChannel, setPreviewChannel] = useState<'inapp' | 'email'>('inapp');

  if (!isOpen) return null;

  const whatsappNum = getWhatsAppSupportNumber(config.whatsapp);

  const handleAplicarPresetCTA = (preset: 'whatsapp' | 'renovar' | 'promo') => {
    if (preset === 'whatsapp') {
      setTextoBoton('Hablar con Soporte');
      const msgEncoded = encodeURIComponent(
        `Hola StreamControl Pro, me comunico respecto al comunicado: "${titulo || 'Consulta de cuenta'}"`
      );
      setLinkBoton(`https://wa.me/${whatsappNum}?text=${msgEncoded}`);
    } else if (preset === 'renovar') {
      setTextoBoton('Renovar mi Plan');
      setLinkBoton('https://streamcontrol.pro/app/suscripciones');
    } else if (preset === 'promo') {
      setTextoBoton('Aprovechar Oferta');
      setLinkBoton('https://streamcontrol.pro');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      toast.error('Por favor ingresá un título');
      return;
    }
    if (!mensaje.trim()) {
      toast.error('Por favor ingresá un mensaje');
      return;
    }
    if (!canalInApp && !canalBanner && !canalEmail) {
      toast.error('Seleccioná al menos un canal de difusión');
      return;
    }

    setEnviando(true);
    try {
      const response = await callFunction<{
        titulo: string;
        mensaje: string;
        tipo: string;
        linkBoton?: string;
        textoBoton?: string;
        segmento: string;
        canales: { inApp: boolean; banner: boolean; email: boolean };
      }, {
        success: boolean;
        totalDestinatarios?: number;
        enviados?: number;
        fallidos?: number;
      }>('enviarComunicadoMasivo', {
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
        tipo,
        linkBoton: linkBoton.trim(),
        textoBoton: textoBoton.trim(),
        segmento,
        canales: {
          inApp: canalInApp,
          banner: canalBanner,
          email: canalEmail,
        },
      });

      if (response?.success) {
        let msgExito = '¡Campaña difundida exitosamente!';
        if (canalEmail) {
          msgExito += ` Correos enviados: ${response.enviados || 0}/${response.totalDestinatarios || 0}`;
        }
        toast.success(msgExito);
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Error al enviar comunicado masivo');
    } finally {
      setEnviando(false);
    }
  };

  const handleClearBannerClick = async () => {
    if (!onClearBanner) return;
    setDesactivandoBanner(true);
    try {
      await onClearBanner();
      toast.success('Banner superior desactivado');
    } catch (err) {
      console.error(err);
      toast.error('Error al desactivar banner');
    } finally {
      setDesactivandoBanner(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col text-slate-100 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 text-cyan-400 flex items-center justify-center shadow-inner">
              <Megaphone size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Marketing & Comunicación Masiva</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-950 text-cyan-300 border border-indigo-800/50">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Publicá avisos in-app, banners globales y correos masivos vía Resend
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'editor'
                ? 'border-indigo-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Editor de Campaña
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye size={15} />
            <span>Vista Previa en Vivo</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'editor' ? (
            <form id="marketing-form" onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Tipo de Alerta */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                  1. Tipo de Alerta / Categoría
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTipo('comunicado')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all ${
                      tipo === 'comunicado'
                        ? 'bg-indigo-950/70 border-indigo-500 text-cyan-300 shadow-md shadow-indigo-950/40'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Megaphone size={18} className="text-indigo-400" />
                    <span className="text-xs font-semibold">📢 Comunicado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('promocion')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all ${
                      tipo === 'promocion'
                        ? 'bg-amber-950/70 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Flame size={18} className="text-amber-400" />
                    <span className="text-xs font-semibold">🔥 Promoción</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('vencimiento')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all ${
                      tipo === 'vencimiento'
                        ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-md shadow-rose-950/40'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Clock size={18} className="text-rose-400" />
                    <span className="text-xs font-semibold">⏰ Vencimiento</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('novedad')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-all ${
                      tipo === 'novedad'
                        ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles size={18} className="text-cyan-400" />
                    <span className="text-xs font-semibold">🚀 Novedad</span>
                  </button>
                </div>
              </div>

              {/* 2. Título & Mensaje */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    2. Título del Comunicado *
                  </label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ej: 🔥 50% de Descuento en Plan Anual o Actualización de Seguridad"
                    className="w-full h-11 px-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    3. Mensaje / Contenido *
                  </label>
                  <textarea
                    rows={4}
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Escribí el contenido del comunicado. Podés incluir saltos de línea para estructurar el mensaje..."
                    className="w-full p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* 3. Botón CTA */}
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    4. Botón de Llamada a la Acción (CTA Opcional)
                  </label>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>Atajos rápidos:</span>
                    <button
                      type="button"
                      onClick={() => handleAplicarPresetCTA('whatsapp')}
                      className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900 transition-colors"
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAplicarPresetCTA('renovar')}
                      className="px-2 py-0.5 rounded bg-indigo-950/60 text-cyan-300 border border-indigo-800/40 hover:bg-indigo-900 transition-colors"
                    >
                      Renovar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAplicarPresetCTA('promo')}
                      className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 hover:bg-amber-900 transition-colors"
                    >
                      Promo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      value={textoBoton}
                      onChange={(e) => setTextoBoton(e.target.value)}
                      placeholder="Texto (Ej: Renovar mi Plan, Hablar con Soporte)"
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={linkBoton}
                      onChange={(e) => setLinkBoton(e.target.value)}
                      placeholder="URL o enlace WhatsApp (https://...)"
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Canales de Difusión */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                  5. Canales de Difusión
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label
                    className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      canalInApp
                        ? 'bg-indigo-950/50 border-indigo-500/60 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={canalInApp}
                      onChange={(e) => setCanalInApp(e.target.checked)}
                      className="accent-indigo-500 w-4 h-4 rounded"
                    />
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-cyan-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold">Campanita In-App</p>
                        <p className="text-[11px] text-slate-400">Dropdown de usuario</p>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      canalBanner
                        ? 'bg-indigo-950/50 border-indigo-500/60 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={canalBanner}
                      onChange={(e) => setCanalBanner(e.target.checked)}
                      className="accent-indigo-500 w-4 h-4 rounded"
                    />
                    <div className="flex items-center gap-2">
                      <LayoutTemplate size={16} className="text-indigo-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold">Banner Superior</p>
                        <p className="text-[11px] text-slate-400">Top bar global</p>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      canalEmail
                        ? 'bg-indigo-950/50 border-indigo-500/60 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={canalEmail}
                      onChange={(e) => setCanalEmail(e.target.checked)}
                      className="accent-indigo-500 w-4 h-4 rounded"
                    />
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold">Correo Masivo</p>
                        <p className="text-[11px] text-slate-400">Despacho Resend</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 5. Segmentación de Audiencia */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                  6. Segmentación de Audiencia
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      segmento === 'todos'
                        ? 'bg-indigo-950/60 border-indigo-500/60 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="segmento"
                      checked={segmento === 'todos'}
                      onChange={() => setSegmento('todos')}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <div>
                      <p className="text-xs font-bold">Todos los usuarios</p>
                      <p className="text-[10px] text-slate-400">Base completa registrada</p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      segmento === 'activos'
                        ? 'bg-indigo-950/60 border-indigo-500/60 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="segmento"
                      checked={segmento === 'activos'}
                      onChange={() => setSegmento('activos')}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <div>
                      <p className="text-xs font-bold">Solo con suscripción activa</p>
                      <p className="text-[10px] text-slate-400">Tenants al día</p>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      segmento === 'por_vencer'
                        ? 'bg-indigo-950/60 border-indigo-500/60 text-white'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="segmento"
                      checked={segmento === 'por_vencer'}
                      onChange={() => setSegmento('por_vencer')}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <div>
                      <p className="text-xs font-bold">Por vencer (≤ 7 días)</p>
                      <p className="text-[10px] text-slate-400">Riesgo o mora próxima</p>
                    </div>
                  </label>
                </div>
              </div>
            </form>
          ) : (
            /* Vista Previa en Vivo */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewChannel('inapp')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      previewChannel === 'inapp'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Campanita In-App
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewChannel('email')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      previewChannel === 'email'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Correo Dark SaaS
                  </button>
                </div>
                <span className="text-xs text-slate-400">Previsualización en tiempo real</span>
              </div>

              {previewChannel === 'inapp' ? (
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 max-w-md mx-auto">
                  <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
                    Dropdown de Notificaciones (In-App)
                  </p>
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-950/80 text-cyan-300 border border-indigo-800/60">
                        {tipo === 'promocion'
                          ? '🔥 Promoción'
                          : tipo === 'vencimiento'
                          ? '⏰ Vencimiento de Plan'
                          : tipo === 'novedad'
                          ? '🚀 Novedad'
                          : '📢 Comunicado'}
                      </span>
                      <span className="text-[10px] text-slate-500">Ahora</span>
                    </div>
                    <h4 className="font-semibold text-white text-sm">
                      {titulo || 'Título de ejemplo del comunicado'}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {mensaje || 'Aquí se mostrará el mensaje que redactes en el formulario.'}
                    </p>
                    {linkBoton && (
                      <div className="pt-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold">
                          <span>{textoBoton || 'Ver más'}</span>
                          <ExternalLink size={12} />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 max-w-lg mx-auto">
                  <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
                    Plantilla Resend Responsive Dark SaaS
                  </p>
                  <div className="bg-[#131b2e] p-6 rounded-2xl border border-[#23304c] text-center space-y-4">
                    <div className="text-indigo-400 font-extrabold text-lg tracking-tight">
                      StreamControl Pro
                    </div>
                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-950/60 text-cyan-300 border border-indigo-800/60">
                      {tipo === 'promocion'
                        ? '🔥 Promoción Especial'
                        : tipo === 'vencimiento'
                        ? '⏰ Alerta de Suscripción'
                        : tipo === 'novedad'
                        ? '🚀 Nueva Función'
                        : '📢 Comunicado Oficial'}
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {titulo || 'Título del correo masivo'}
                    </h3>
                    <div className="text-left bg-[#0c1222] p-4 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                      {mensaje || 'Cuerpo del mensaje en formato responsive Dark SaaS.'}
                    </div>
                    {linkBoton && (
                      <div>
                        <span className="inline-block bg-gradient-to-r from-indigo-500 to-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg">
                          {textoBoton || 'Acceder ahora'} &rarr;
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {bannerActivo && onClearBanner && (
              <button
                type="button"
                onClick={handleClearBannerClick}
                disabled={desactivandoBanner}
                className="px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900 border border-rose-800/40 text-rose-300 text-xs font-medium transition-colors"
              >
                {desactivandoBanner ? 'Desactivando...' : 'Desactivar Banner Superior'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none btn-secondary text-xs sm:text-sm px-4 py-2.5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="marketing-form"
              disabled={enviando}
              className="flex-1 sm:flex-none btn-primary text-xs sm:text-sm px-6 py-2.5 shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2"
            >
              {enviando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Difundiendo...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Publicar & Difundir</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
