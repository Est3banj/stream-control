/**
 * Configuración central: lectura de env vars con validación clara.
 * NUNCA se expone el valor de un secreto en mensajes de error.
 */

/**
 * Allowlist de orígenes legítimos (match EXACTO, sin comodines):
 * Firebase Hosting sirve la SPA en los 3 dominios canónicos del proyecto
 * (custom, web.app y firebaseapp.com) — verificado HTTP 200 en los tres.
 * En desarrollo (NODE_ENV !== 'production') se agregan localhost para el proxy de Vite.
 */
export const ALLOWED_ORIGINS: string[] = [
  'https://streamcontrol.pro',
  'https://streamcontrol-10837.web.app',
  'https://streamcontrol-10837.firebaseapp.com',
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:5173', 'http://localhost:3001']
    : []),
];

export const DEFAULT_APP_URL = 'https://streamcontrol-10837.firebaseapp.com';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Env var ${name} no configurada`);
  }
  return value;
}

export function FIREBASE_SERVICE_ACCOUNT(): string {
  return requireEnv('FIREBASE_SERVICE_ACCOUNT');
}

export function CRON_SECRET(): string {
  return process.env.CRON_SECRET || '';
}

export function TELEGRAM_TOKEN(): string {
  return process.env.TELEGRAM_TOKEN || '';
}

export function TELEGRAM_WEBHOOK_SECRET(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET || '';
}

export function SMTP_USER(): string {
  return process.env.SMTP_USER || '';
}

export function SMTP_PASS(): string {
  return process.env.SMTP_PASS || '';
}

export function APP_URL(): string {
  return process.env.APP_URL || DEFAULT_APP_URL;
}