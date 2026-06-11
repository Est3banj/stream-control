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
  createdAt: string;
}

export type FirebaseUserWithData = User & Partial<Usuario>;
