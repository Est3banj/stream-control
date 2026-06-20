import { useMemo } from 'react';
import useSuscripciones from './useSuscripciones';
import type { Suscripcion } from '../types/suscripcion';

export interface Permisos {
  /** Nombre del plan actual del usuario */
  planNombre: string | null;
  /** Carga inicial */
  loading: boolean;
  /** Clientes máximos permitidos (Infinity = ilimitado) */
  clienteLimit: number;
  /** Puede usar Telegram */
  puedeUsarTelegram: boolean;
  /** Puede ver reportes avanzados */
  puedeVerReportesAvanzados: boolean;
  /** Puede exportar a Excel */
  puedeExportarExcel: boolean;
  /** Puede ver dashboard ejecutivo */
  puedeVerDashboardEjecutivo: boolean;
  /** Tiene soporte prioritario */
  tieneSoportePrioritario: boolean;
  /** Tiene soporte 24/7 */
  tieneSoporte247: boolean;
}

export const PLAN_FEATURES: Record<string, Partial<Permisos>> = {
  Starter: {
    clienteLimit: 30,
    puedeUsarTelegram: false,
    puedeVerReportesAvanzados: false,
    puedeExportarExcel: true,
    puedeVerDashboardEjecutivo: false,
    tieneSoportePrioritario: false,
    tieneSoporte247: false,
  },
  Professional: {
    clienteLimit: Infinity,
    puedeUsarTelegram: true,
    puedeVerReportesAvanzados: true,
    puedeExportarExcel: true,
    puedeVerDashboardEjecutivo: false,
    tieneSoportePrioritario: true,
    tieneSoporte247: false,
  },
  Enterprise: {
    clienteLimit: Infinity,
    puedeUsarTelegram: true,
    puedeVerReportesAvanzados: true,
    puedeExportarExcel: true,
    puedeVerDashboardEjecutivo: true,
    tieneSoportePrioritario: true,
    tieneSoporte247: true,
  },
};

const DEFAULT_PERMISOS: Permisos = {
  planNombre: null,
  loading: true,
  clienteLimit: 0,
  puedeUsarTelegram: false,
  puedeVerReportesAvanzados: false,
  puedeExportarExcel: false,
  puedeVerDashboardEjecutivo: false,
  tieneSoportePrioritario: false,
  tieneSoporte247: false,
};

export function detectarFamilia(nombre: string): string {
  if (!nombre) return 'Starter';
  const n = nombre.toLowerCase().trim();
  if (n === 'admin') return 'Admin';
  if (n.startsWith('enterprise')) return 'Enterprise';
  if (n.startsWith('professional')) return 'Professional';
  if (n === 'starter') return 'Starter';
  // Fallback: si contiene palabras clave en cualquier posición
  if (n.includes('enterprise')) return 'Enterprise';
  if (n.includes('professional') || n.includes('pro')) return 'Professional';
  return 'Starter';
}

export default function usePermisos(
  user: { uid?: string; rol?: string } | null
): Permisos {
  const { suscripciones, loading, error } = useSuscripciones(user);
  const isAdmin = user?.rol === 'admin';

  if (import.meta.env.DEV && error) {
    console.warn('[usePermisos] Error en listener de suscripciones:', error);
  }

  return useMemo(() => {
    // Admin no tiene restricciones
    if (isAdmin) {
      if (import.meta.env.DEV) {
        console.log('[usePermisos] Admin detectado — todos los permisos concedidos');
      }
      return {
        planNombre: 'Admin',
        loading: false,
        clienteLimit: Infinity,
        puedeUsarTelegram: true,
        puedeVerReportesAvanzados: true,
        puedeExportarExcel: true,
        puedeVerDashboardEjecutivo: true,
        tieneSoportePrioritario: true,
        tieneSoporte247: true,
      };
    }

    if (loading) return DEFAULT_PERMISOS;
    if (!user?.uid) return { ...DEFAULT_PERMISOS, loading: false };

    // Buscar suscripción activa del usuario
    const activa = (suscripciones as Suscripcion[]).find(
      (s) => s.estado === 'activa'
    );

    if (!activa) {
      if (import.meta.env.DEV) {
        console.log('[usePermisos] Sin suscripción activa para', user.uid, '- plan Starter');
      }
      return { ...DEFAULT_PERMISOS, loading: false, planNombre: 'Starter' };
    }

    const familia = detectarFamilia(activa.planNombre);
    const features = PLAN_FEATURES[familia] || PLAN_FEATURES.Starter;

    if (import.meta.env.DEV) {
      console.log('[usePermisos] Plan detectado:', activa.planNombre, '→ familia:', familia, '→ features:', features);
    }

    return {
      planNombre: activa.planNombre,
      loading: false,
      clienteLimit: features.clienteLimit ?? Infinity,
      puedeUsarTelegram: features.puedeUsarTelegram ?? false,
      puedeVerReportesAvanzados: features.puedeVerReportesAvanzados ?? false,
      puedeExportarExcel: features.puedeExportarExcel ?? false,
      puedeVerDashboardEjecutivo: features.puedeVerDashboardEjecutivo ?? false,
      tieneSoportePrioritario: features.tieneSoportePrioritario ?? false,
      tieneSoporte247: features.tieneSoporte247 ?? false,
    };
  }, [user, suscripciones, loading, isAdmin]);
}
