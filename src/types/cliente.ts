export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  correo?: string;
  plataforma: string;
  estado: 'activo' | 'inactivo';
  propietarioId: string;
  usuarioEmail: string;
  fechaVencimiento: string;
  saldoPendiente: number;
  diasRestantes?: number | null;
  cuentaId?: string;
  perfilAsignado?: string;
}
