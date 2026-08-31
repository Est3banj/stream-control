/**
 * FN_REGISTRY: whitelist explícita de rutas POST /api/{fn} (AD-1).
 * 17 rutas: 10 bearer (8 endpoints + 2 triggers post-write), 5 none, 1 admin, 1 cron.
 * (Corrección fresh-eyes: el task decía "9 bearer [incluye los 2 triggers]" — 8 endpoints
 *  + 2 triggers = 10; 17 = 10 + 5 none + 1 admin + 1 cron.)
 */

import type { Request, Response } from 'express';
import * as codigos from './codigos.js';
import * as handlers from './handlers.js';
import * as emailVerification from './emailVerification.js';
import * as otpVerification from './otpVerification.js';
import { sha256 } from './rateLimit.js';

export interface AuthedReq extends Request {
  auth?: { uid: string; token: Record<string, unknown> };
  data?: unknown;
}

export interface RateLimitRule {
  scope: string;
  key: (req: Request) => string;
  max: number;
  windowMs: number;
  message: string;
}

export interface RouteDef {
  auth: 'none' | 'bearer' | 'admin' | 'cron';
  raw?: boolean;
  rateLimits?: RateLimitRule[];
  handler: (req: AuthedReq, res: Response) => Promise<unknown>;
}

const dataOf = (req: Request): Record<string, unknown> => ((req as AuthedReq).data ?? {}) as Record<string, unknown>;

const MSG_DIRECTO = 'Demasiadas consultas. Esperá un momento antes de intentar de nuevo.';
const MSG_VALIDAR = 'Demasiadas consultas. Intenta de nuevo en unos minutos.';
const MSG_RECUPERACION = 'Esperá un minuto antes de solicitar otro correo de recuperación';
const MSG_VERIFICACION = 'Esperá un minuto antes de reenviar el correo de verificación';
const MSG_OTP = 'Esperá un minuto antes de solicitar otro código OTP';

export const FN_REGISTRY: Record<string, RouteDef> = {
  // ── 10 bearer ──
  generarToken: { auth: 'bearer', handler: codigos.generarToken },
  guardarCredenciales: { auth: 'bearer', handler: codigos.guardarCredenciales },
  toggleToken: { auth: 'bearer', handler: codigos.toggleToken },
  consultarCodigoDirecto: {
    auth: 'bearer',
    handler: codigos.consultarCodigoDirecto,
    rateLimits: [
      { scope: 'uid', key: (req) => (req as AuthedReq).auth!.uid, max: 10, windowMs: 60_000, message: MSG_DIRECTO },
      { scope: 'cuenta', key: (req) => String(dataOf(req).cuentaId ?? ''), max: 5, windowMs: 60_000, message: MSG_DIRECTO },
    ],
  },
  generarTokenSubdistribuidor: { auth: 'bearer', handler: codigos.generarTokenSubdistribuidor },
  obtenerCredencialesCuenta: { auth: 'bearer', handler: codigos.obtenerCredencialesCuenta },
  desasignarPerfil: { auth: 'bearer', handler: handlers.desasignarPerfil },
  desvincularTelegram: { auth: 'bearer', handler: handlers.desvincularTelegram },
  onNuevoUsuario: { auth: 'bearer', handler: handlers.onNuevoUsuario },
  onNotificacionEmail: { auth: 'bearer', handler: handlers.onNotificacionEmail },

  // ── 7 none ──
  validarToken: {
    auth: 'none',
    handler: codigos.validarToken,
    rateLimits: [
      { scope: 'token', key: (req) => String(dataOf(req).token ?? ''), max: 30, windowMs: 60_000, message: MSG_VALIDAR },
    ],
  },
  consultarCodigo: { auth: 'none', handler: codigos.consultarCodigo },
  enviarCorreoRecuperacion: {
    auth: 'none',
    handler: handlers.enviarCorreoRecuperacion,
    rateLimits: [
      { scope: 'email', key: (req) => sha256(String(dataOf(req).email ?? '')), max: 1, windowMs: 60_000, message: MSG_RECUPERACION },
    ],
  },
  enviarCorreoVerificacion: {
    auth: 'none',
    handler: emailVerification.generarTokenVerificacion,
    rateLimits: [
      { scope: 'email', key: (req) => sha256(String(dataOf(req).email ?? '')), max: 1, windowMs: 60_000, message: MSG_VERIFICACION },
    ],
  },
  verificarEmailToken: {
    auth: 'none',
    handler: emailVerification.verificarEmailToken,
  },
  enviarCodigoOTP: {
    auth: 'none',
    handler: otpVerification.enviarCodigoOTP,
    rateLimits: [
      { scope: 'email', key: (req) => sha256(String(dataOf(req).email ?? '')), max: 1, windowMs: 60_000, message: MSG_OTP },
    ],
  },
  verificarCodigoOTP: {
    auth: 'none',
    handler: otpVerification.verificarCodigoOTP,
  },
  telegramWebhook: { auth: 'none', raw: true, handler: handlers.telegramWebhook },

  // ── 1 admin ──
  listarVerificados: { auth: 'admin', handler: handlers.listarVerificados },

  // ── 1 cron ──
  cleanupNoVerificados: { auth: 'cron', handler: handlers.cleanupNoVerificados },
};