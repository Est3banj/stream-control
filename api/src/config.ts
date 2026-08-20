/**
 * Configuración central: lectura de env vars con validación clara.
 * NUNCA se expone el valor de un secreto en mensajes de error.
 */

export const ALLOWED_ORIGIN = 'https://streamcontrol.pro';

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
  return requireEnv('SMTP_USER');
}

export function SMTP_PASS(): string {
  return requireEnv('SMTP_PASS');
}

export function APP_URL(): string {
  return process.env.APP_URL || DEFAULT_APP_URL;
}