import type { Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol: 'admin' | 'usuario';
  estado: 'activo' | 'inactivo';
  activoHasta: string | Timestamp;
  plan?: string;
  moneda?: string;
  tasa?: number;
  createdAt: string;
}

export type FirebaseUserWithData = User & Partial<Usuario>;

// ──────────────────────────────────────────────
// Monedas compatibles
// ──────────────────────────────────────────────

export interface Moneda {
  codigo: string;
  pais: string;
  simbolo: string;
  defTasa: number;
}

export const MONEDAS: Moneda[] = [
  { codigo: 'COP', pais: 'Colombia',       simbolo: '$',       defTasa: 1 },
  { codigo: 'USD', pais: 'Estados Unidos', simbolo: 'US$',     defTasa: 0.00024 },
  { codigo: 'MXN', pais: 'México',         simbolo: '$',       defTasa: 0.0045 },
  { codigo: 'CLP', pais: 'Chile',          simbolo: '$',       defTasa: 0.21 },
  { codigo: 'ARS', pais: 'Argentina',      simbolo: '$',       defTasa: 0.22 },
  { codigo: 'PEN', pais: 'Perú',           simbolo: 'S/',      defTasa: 0.00088 },
];

export const MONEDA_POR_DEFECTO = 'COP';
export const TASA_POR_DEFECTO = 1;

/**
 * Devuelve el locale BCP 47 para una moneda dada.
 * Se usa con Intl.NumberFormat para formatear precios.
 */
export function getLocale(moneda: string): string {
  const mapa: Record<string, string> = {
    COP: 'es-CO',
    USD: 'en-US',
    MXN: 'es-MX',
    CLP: 'es-CL',
    ARS: 'es-AR',
    PEN: 'es-PE',
  };
  return mapa[moneda] || 'es-CO';
}
