export type VerificationStep =
  | 'AWAITING'          // Esperando ingreso o validación
  | 'AWAITING_INPUT'    // Esperando código OTP de 6 dígitos
  | 'VERIFYING'         // Validando código contra la API
  | 'CHECKING_MANUAL'   // Comprobación manual
  | 'SUCCESS'           // Verificado exitosamente (celebración + redirect)
  | 'EDITING_EMAIL';    // Modal de cambio de correo abierto

export interface OtpState {
  code: string;
  isSubmitting: boolean;
  error: string | null;
  attemptsRemaining: number | null;
}

export interface CooldownState {
  remainingSeconds: number;
  isActive: boolean;
}

export interface SyncMessage {
  type: 'EMAIL_VERIFIED';
  senderId?: string;
  uid?: string;
  timestamp: number;
}

