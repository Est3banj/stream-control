import type { Timestamp } from 'firebase/firestore';

export interface Plan {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracionDias: number;
  features: string[];
  activo: boolean;
  createdAt: Timestamp;
}

export type PlanInput = Omit<Plan, 'id' | 'createdAt'>;
