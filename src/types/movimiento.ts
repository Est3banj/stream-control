import type { Timestamp } from 'firebase/firestore';

export interface Movimiento {
  id: string;
  tipo: 'Ingreso' | 'Egreso';
  monto: number;
  descripcion: string;
  fecha: Timestamp;
  propietarioId: string;
  usuarioEmail: string;
}
