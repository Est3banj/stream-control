import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Check } from 'lucide-react';
import usePermisos, { PLAN_FEATURES, detectarFamilia } from '../hooks/usePermisos';
import usePlanes from '../hooks/usePlanes';
import { FEATURE_LABELS, PLAN_LABELS } from '../hooks/planFeatures';
import { useAdminConfig, sanitizarWhatsApp } from '../hooks/useAdminConfig';
import type { Permisos } from '../hooks/usePermisos';
import { PERIODOS, PERIODOS_LABELS, PERIODOS_MESES, type Plan, type Periodo } from '../types/plan';

interface UpgradeModalProps {
  user: { uid?: string; rol?: string; email?: string | null } | null;
  onClose: () => void;
}

const ALL_FEATURE_KEYS: (keyof Omit<Permisos, 'planNombre' | 'loading'>)[] = [
  'clienteLimit',
  'puedeUsarTelegram',
  'puedeVerReportesAvanzados',
  'puedeExportarExcel',
  'puedeVerDashboardEjecutivo',
  'tieneSoportePrioritario',
  'tieneSoporte247',
];

const ALL_FAMILIAS = ['Starter', 'Professional', 'Enterprise'] as const;
type Familia = (typeof ALL_FAMILIAS)[number];

const PERIODOS_DIAS: Record<Periodo, number> = {
  mensual: 30,
  trimestral: 90,
  semestral: 180,
  anual: 365,
};

/** Busca el plan de una familia cuyo duracionDias coincida con el período (±15 días). */
function findPlanForPeriod(planes: Plan[], familia: string, periodo: Periodo): Plan | undefined {
  const targetDias = PERIODOS_DIAS[periodo];
  const familiaPlans = planes.filter((p) => detectarFamilia(p.nombre) === familia);
  if (familiaPlans.length === 0) return undefined;
  // Match exacto por duración
  const exact = familiaPlans.find((p) => Math.abs(p.duracionDias - targetDias) <= 15);
  return exact ?? familiaPlans[0];
}

/** Extrae el período desde el nombre del plan (p.ej. "Enterprise Trimestral" → 'trimestral'). */
function detectarPeriodoDesdeNombre(nombre: string): Periodo {
  const n = nombre.toLowerCase();
  if (n.includes('anual')) return 'anual';
  if (n.includes('semestral')) return 'semestral';
  if (n.includes('trimestral')) return 'trimestral';
  return 'mensual';
}

function formatFeatureValue(
  key: string,
  value: boolean | number | undefined,
): string {
  if (value === undefined) return '';
  if (key === 'clienteLimit') {
    if (value === Infinity) return 'Ilimitado';
    return `${value} clientes`;
  }
  return value ? 'Sí' : 'No';
}

/** Construye el href de contacto (WhatsApp o mailto) para un plan específico */
function buildCtaHref(
  whatsappNumber: string,
  userEmail: string | null | undefined,
  planLabel: string,
  precio: string,
  periodo: string,
): string {
  const body = encodeURIComponent(
    'Hola, quisiera actualizar mi plan.\n\n' +
    `Mis datos:\n` +
    `Correo: ${userEmail || '—'}\n` +
    `Plan deseado: ${planLabel}\n` +
    `Periodo: ${periodo}\n` +
    (precio ? `Precio: ${precio}\n` : '') +
    '\nSaludos.',
  );
  return whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${body}`
    : `mailto:ventas@streamcontrol.com?subject=${encodeURIComponent(`Solicitud de actualización a ${planLabel} (${periodo})`)}&body=${body}`;
}

export default function UpgradeModal({ user, onClose }: UpgradeModalProps) {
  const permisos = usePermisos(user);
  const { planes, loading: planesLoading } = usePlanes(user);
  const { config: adminConfig, loading: configLoading } = useAdminConfig();
  const [dismissed, setDismissed] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('mensual');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    try {
      sessionStorage.setItem('upgrade_modal_shown', '1');
    } catch {
      // Fail silently
    }
    setDismissed(true);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
  }, []);

  if (dismissed) return null;
  if (permisos.loading || planesLoading || configLoading) return null;
  if (!permisos.planNombre) return null;

  const currentFamilia = detectarFamilia(permisos.planNombre) as Familia;
  const currentPeriodo = detectarPeriodoDesdeNombre(permisos.planNombre);

  const whatsappNumber = sanitizarWhatsApp(adminConfig.whatsapp);

  // Precio mensual del plan actual del usuario (para calcular el ahorro en el toggle)
  const currentPrecioMensual = findPlanForPeriod(planes, currentFamilia, 'mensual')?.precio ?? 0;

  // Preparar data de cada plan
  const planCards = ALL_FAMILIAS.map((familia) => {
    // Busca el plan que matchea familia + período actual
    const planFirestore = findPlanForPeriod(planes, familia, periodo);
    // Busca el plan mensual de la misma familia (para calcular el precio original tachado)
    const planMensual = findPlanForPeriod(planes, familia, 'mensual');

    const features = PLAN_FEATURES[familia];
    const label = PLAN_LABELS[familia] || familia;
    const precioActual = planFirestore?.precio ?? 0;
    const precioMensual = planMensual?.precio ?? 0;

    const esActual = familia === currentFamilia && periodo === currentPeriodo;
    const esRecomendado = familia === 'Professional';

    // Precio display
    const sufijo = periodo === 'mensual' ? 'mes' : periodo === 'trimestral' ? 'trimestre' : periodo === 'semestral' ? 'semestre' : 'año';
    const precioDisplay = planFirestore
      ? (precioActual > 0
          ? `$${precioActual.toLocaleString('es-CO')}/${sufijo}`
          : 'Gratuito')
      : 'Consultar';

    // Precio original tachado: para planes no actuales, el precio sin descuento
    const precioBaseMeses = precioMensual * PERIODOS_MESES[periodo];
    const precioOrig = !esActual && precioBaseMeses > 0
      ? (periodo === 'mensual' ? precioMensual * 2 : precioBaseMeses)
      : 0;

    const formatoOrig = precioOrig > 0
      ? `$${precioOrig.toLocaleString('es-CO')}/${sufijo}`
      : '';

    const descuento = periodo === 'mensual'
      ? (precioOrig > 0 ? Math.round((1 - precioActual / precioOrig) * 100) : 0)
      : Math.round((1 - precioActual / precioBaseMeses) * 100);

    const ctaHref = esActual
      ? ''
      : buildCtaHref(whatsappNumber, user?.email, label, precioDisplay, periodo);

    return {
      familia, features, label,
      precioDisplay, formatoOrig, descuento,
      esActual, esRecomendado, ctaHref,
    };
  });

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 sm:pt-12 overflow-y-auto bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-6xl animate-scale-in relative bg-white rounded-2xl shadow-2xl p-6 sm:p-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
      >
        <button
          ref={closeButtonRef}
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
          aria-label="Cerrar"
        >
          <X size={24} className="text-gray-600" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 max-w-2xl mx-auto">
          <h2
            id="upgrade-modal-title"
            className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight"
          >
            Cambia a un plan superior para disfrutar de un acceso ampliado a StreamControl
          </h2>
          <p className="text-sm text-gray-500 mt-3">
            Cancela cuando quieras. Al suscribirte, aceptas los términos y condiciones del servicio.
          </p>
        </div>

        {/* Toggle de período */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <div className="inline-flex items-center bg-gray-100 rounded-xl p-1">
            {PERIODOS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  periodo === p
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {PERIODOS_LABELS[p]}
              </button>
            ))}
          </div>

          {periodo !== 'mensual' && (
            <>
              <span className="text-xs sm:text-sm text-green-700 font-semibold whitespace-nowrap">
                {(() => {
                  const meses = PERIODOS_MESES[periodo];
                  const precioPlanPeriodo = findPlanForPeriod(planes, currentFamilia, periodo)?.precio ?? 0;
                  const ahorro = currentPrecioMensual > 0 && precioPlanPeriodo > 0
                    ? Math.round((1 - precioPlanPeriodo / (currentPrecioMensual * meses)) * 100)
                    : 0;
                  return ahorro > 0 && precioPlanPeriodo > 0
                    ? `Ahorra un ${ahorro}% al pagar ${PERIODOS_LABELS[periodo].toLowerCase()}`
                    : '';
                })()}
              </span>
              <span className="px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
                Recomendado
              </span>
            </>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {planCards.map((plan) => (
            <div
              key={plan.familia}
              className={`rounded-2xl border-2 p-6 relative flex flex-col ${
                plan.esActual
                  ? 'border-gray-200'
                  : plan.esRecomendado
                    ? 'border-blue-500 shadow-lg shadow-blue-100'
                    : 'border-gray-200'
              }`}
            >
              {/* Badge RECOMENDADO (solo en mensual, en otros períodos se muestra arriba) */}
              {plan.esRecomendado && !plan.esActual && periodo === 'mensual' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wide shadow-md">
                    Recomendado
                  </span>
                </div>
              )}

              {/* Plan name */}
              <div className={`mb-4 ${plan.esRecomendado && !plan.esActual && periodo === 'mensual' ? 'mt-2' : ''}`}>
                <h3 className="text-xl font-bold text-gray-900">{plan.label}</h3>
              </div>

              {/* Pricing */}
              <div className="mb-4">
                {plan.formatoOrig && (
                  <div className="text-sm text-gray-400 line-through font-medium">
                    {plan.formatoOrig}
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-gray-900">
                    {plan.precioDisplay}
                  </span>
                  {plan.descuento > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                      -{plan.descuento}%
                    </span>
                  )}
                </div>
              </div>

              {/* CTA or current-plan badge */}
              {plan.esActual ? (
                <span className="block w-full py-2.5 px-6 rounded-xl bg-gray-100 text-gray-500 font-semibold text-center text-sm mb-4">
                  Tu plan actual
                </span>
              ) : (
                <>
                  <a
                    href={plan.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block w-full py-3 px-6 rounded-xl text-white font-bold text-center shadow-lg hover:shadow-xl transition-all mb-1 ${
                      plan.esRecomendado
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700'
                        : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900'
                    }`}
                  >
                    Elegir {plan.label}
                  </a>
                  <p className="text-xs text-gray-500 mb-4 text-center">
                    {whatsappNumber
                      ? 'Te contactaremos por WhatsApp'
                      : 'Te contactaremos por correo'}
                  </p>
                </>
              )}

              {/* Features */}
              <ul className="space-y-3 flex-1 border-t border-gray-100 pt-4">
                {ALL_FEATURE_KEYS.map((key) => {
                  const val = plan.features[key];
                  return (
                    <li key={key} className="flex items-start gap-2 text-sm">
                      {key === 'clienteLimit' ? (
                        <span className="text-gray-700 font-medium">
                          <Check size={18} className="text-green-500 mt-0.5 shrink-0 inline mr-1" />
                          <span className="text-gray-500">{FEATURE_LABELS[key]}:</span>{' '}
                          {val === Infinity ? 'Ilimitado' : `${val} clientes`}
                        </span>
                      ) : (
                        <>
                          {val ? (
                            <Check size={18} className="text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <span className="w-[18px] inline-block text-gray-300 mt-0.5 shrink-0 text-center">—</span>
                          )}
                          <span className={val ? 'text-gray-700' : 'text-gray-400'}>
                            {FEATURE_LABELS[key]}
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Expandable: tabla comparativa completa */}
        <div className="mt-8 border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowAllFeatures(!showAllFeatures)}
            className="flex items-center justify-center gap-2 w-full text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showAllFeatures ? 'Ocultar' : 'Mostrar'} todas las ventajas
            <svg
              className={`w-4 h-4 transition-transform ${showAllFeatures ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAllFeatures && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 pr-4 text-left font-semibold text-gray-700">Característica</th>
                    {ALL_FAMILIAS.map((f) => (
                      <th key={f} className="py-2 px-3 text-center font-semibold text-gray-600">
                        {PLAN_LABELS[f] || f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALL_FEATURE_KEYS.map((key) => {
                    const valores = ALL_FAMILIAS.map((f) => PLAN_FEATURES[f][key]);
                    const hayDiff = new Set(valores.map((v) => String(v))).size > 1;
                    return (
                      <tr key={key} className={`border-b border-gray-100 ${hayDiff ? 'bg-blue-50/50' : ''}`}>
                        <td className="py-2.5 pr-4 text-gray-700 font-medium whitespace-nowrap">
                          {FEATURE_LABELS[key]}
                        </td>
                        {ALL_FAMILIAS.map((f, idx) => {
                          const val = PLAN_FEATURES[f][key];
                          const display = formatFeatureValue(key, val);
                          return (
                            <td
                              key={f}
                              className={`py-2.5 px-3 text-center ${
                                hayDiff && idx >= 1 ? 'font-semibold text-green-700' : 'text-gray-600'
                              }`}
                            >
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
