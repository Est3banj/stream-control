export interface HookState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

export interface UseVentasReturn {
  ventas: import('./venta').Venta[];
  loading: boolean;
  error: string | null;
  crearVenta: (venta: import('./venta').VentaInput) => Promise<void>;
  actualizarVenta: (id: string, data: Partial<import('./venta').Venta>) => Promise<void>;
  eliminarVenta: (id: string) => Promise<void>;
}

export interface UseClientesReturn {
  clientes: import('./cliente').Cliente[];
  loading: boolean;
  error: string | null;
  toggleEstado: (id: string, estadoActual: string) => Promise<void>;
}

export interface NotificacionDerivada {
  id: string;
  clienteId: string;
  nombreCliente: string;
  plataforma: string;
  telefono: string;
  correo: string;
  diasRestantes: number | null;
  fechaVencimiento?: string;
  propietarioId: string;
  usuarioEmail: string;
  saldoPendiente?: number;
  tipo: 'vencimiento' | 'mora';
}
