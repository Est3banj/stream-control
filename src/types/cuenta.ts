import type { Timestamp } from 'firebase/firestore';

export interface PerfilCuenta {
  nombre: string;
  pin: string;
  estado: 'disponible' | 'asignado';
  clienteId?: string;
  clienteNombre?: string;
  fechaAsignacion?: string;
}

export interface Cuenta {
  id: string;
  propietarioId: string;
  proveedor: string;
  correoCuenta: string;
  costo: number;
  tipoVenta: 'perfiles' | 'completa';
  perfiles: PerfilCuenta[];
  estado: 'disponible' | 'asignada' | 'expirada';
  fechaInicio?: string;
  diasServicio?: number;
  fechaVencimiento?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateCuentaInput = Omit<Cuenta, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCuentaInput = Partial<Omit<Cuenta, 'id' | 'createdAt' | 'propietarioId'>>;
