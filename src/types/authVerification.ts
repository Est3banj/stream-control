export type VerificationStep =
  | 'AWAITING'          // Esperando validación (radar activo + polling)
  | 'CHECKING_MANUAL'   // Usuario presionó "Comprobar ahora"
  | 'SUCCESS'           // Verificado exitosamente (celebración + redirect)
  | 'EDITING_EMAIL';    // Modal de cambio de correo abierto

export interface CooldownState {
  remainingSeconds: number;
  isActive: boolean;
}

export interface SyncMessage {
  type: 'EMAIL_VERIFIED';
  uid?: string;
  timestamp: number;
}
