/**
 * Errores del dominio: APIError con código tipo callable + mapa code → HTTP status.
 * El envelope de error SIEMPRE es { error: { code, message } } con code SIN prefijo
 * (el frontend agrega 'functions/' al mapear a FirebaseError).
 */

export class APIError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'APIError';
    this.code = code;
  }
}

export function errorEnvelope(code: string, message: string): { error: { code: string; message: string } } {
  return { error: { code, message } };
}

const HTTP_STATUS_MAP: Record<string, number> = {
  'invalid-argument': 400,
  unauthenticated: 401,
  'permission-denied': 403,
  'not-found': 404,
  'deadline-exceeded': 408,
  'already-exists': 409,
  'failed-precondition': 409,
  'resource-exhausted': 429,
  unavailable: 503,
};

export function errorStatusFor(code: string): number {
  return HTTP_STATUS_MAP[code] ?? 500;
}