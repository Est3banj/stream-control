import type { Timestamp } from 'firebase/firestore';

export type EstadoSuscripcion = 'activa' | 'expirada' | 'cancelada';

export type PagoEstado = 'pagado' | 'pendiente' | 'vencido';

export interface Suscripcion {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  planId: string;
  planNombre: string;
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  estado: EstadoSuscripcion;
  pagoEstado: PagoEstado;
  monto: number;
  notas?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateSuscripcionInput = Omit<Suscripcion, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateSuscripcionInput = Partial<Omit<Suscripcion, 'id' | 'createdAt' | 'usuarioId' | 'planId' | 'monto'>>;
