import type { Timestamp } from 'firebase/firestore';

export interface Notificacion {
  id: string;
  clienteId: string;
  nombreCliente: string;
  plataforma: string;
  diasRestantes: number;
  fechaVencimiento?: string;
  propietarioId: string;
  usuarioEmail: string;
  fechaGenerada: Timestamp;
  leida: boolean;
}
