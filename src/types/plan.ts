import type { Timestamp } from 'firebase/firestore';

export interface PreciosPeriodo {
  mensual: number;
  trimestral?: number;
  semestral?: number;
  anual?: number;
}

export interface Plan {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precios?: PreciosPeriodo;
  duracionDias: number;
  features: string[];
  activo: boolean;
  createdAt: Timestamp;
}

export type PlanInput = Omit<Plan, 'id' | 'createdAt'>;

export type Periodo = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export const PERIODOS: Periodo[] = ['mensual', 'trimestral', 'semestral', 'anual'];

export const PERIODOS_LABELS: Record<Periodo, string> = {
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export const PERIODOS_MESES: Record<Periodo, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};
