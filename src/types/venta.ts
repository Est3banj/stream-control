import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface Venta {
  id: string;
  nombre: string;
  telefono: string;
  correo?: string;
  plataforma: string;
  pantallas: number;
  precioVenta: number;
  costoServicio: number;
  utilidad: number;
  fechaInicio: string;
  fechaVenta: string;
  diasServicio: number;
  perfil?: string;
  pinPerfil?: string;
  pagado: boolean;
  saldoPendiente: number;
  fechaRegistro: Timestamp;
  fechaRegistroSistema: Timestamp | null;
  fechaVencimiento: string;
  propietarioId: string;
  usuarioEmail: string;
  cuentaId?: string;
  perfilNombre?: string;
  perfilPin?: string;
  tokenGenerado?: string;
  costoPorPerfil?: number;
  esSubdistribuidor?: boolean;
  grupoId?: string; // Agrupa ventas multi-servicio
  perfiles?: Array<{ nombre: string; pin: string }>;
}

export type VentaInput = Omit<Venta, 'id' | 'fechaRegistro' | 'fechaRegistroSistema' | 'utilidad'> & {
  fechaRegistro: FieldValue;
  fechaRegistroSistema: null;
  utilidad: number;
};
