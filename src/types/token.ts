import type { Timestamp } from 'firebase/firestore';

export interface TokenCliente {
  id: string;
  token: string;
  cuentaId: string;
  perfilNombre: string;
  clienteId: string;
  clienteNombre: string;
  vendedorId: string;
  expiraEn: string;
  activo: boolean;
  createdAt: Timestamp;
}

export type CreateTokenInput = Omit<TokenCliente, 'id' | 'createdAt'>;
