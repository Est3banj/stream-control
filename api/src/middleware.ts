/**
 * Middlewares: CORS estricto (allowlist de orígenes de Hosting, match exacto),
 * auth Bearer, requireAdmin (claims + fallback Firestore), cronSecret (constant-time),
 * errorMiddleware.
 */

import type { NextFunction, Request, Response } from 'express';
import * as crypto from 'crypto';
import { ALLOWED_ORIGINS, CRON_SECRET } from './config.js';
import { APIError, errorEnvelope, errorStatusFor } from './errors.js';
import { db, getAdmin } from './firebase.js';

export interface AuthedRequest extends Request {
  auth?: { uid: string; token: Record<string, unknown> };
  data?: unknown;
}

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json(errorEnvelope(code, message));
}

// ── CORS ────────────────────────────────────────────────────────────────

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (!origin) {
    next();
    return;
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
    return;
  }

  // Origin ajeno → sin ACAO (el navegador bloquea): 403 en no-preflight, OPTIONS mudo 204
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  sendError(res, 403, 'permission-denied', 'Origin no permitido');
}

// ── Auth Bearer ─────────────────────────────────────────────────────────

export async function verifyBearer(req: Request): Promise<NonNullable<AuthedRequest['auth']>> {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1].length === 0) {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }
  try {
    const decoded = await getAdmin().auth().verifyIdToken(parts[1]);
    return { uid: decoded.uid, token: decoded as Record<string, unknown> };
  } catch {
    throw new APIError('unauthenticated', 'Debes iniciar sesión');
  }
}

export async function authBearer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    (req as AuthedRequest).auth = await verifyBearer(req);
    next();
  } catch {
    sendError(res, 401, 'unauthenticated', 'Debes iniciar sesión');
  }
}

// ── Require admin (parity v2 index.ts:586-592) ──────────────────────────

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authed = req as AuthedRequest;
  if (!authed.auth) {
    sendError(res, 401, 'unauthenticated', 'Debes iniciar sesión');
    return;
  }

  const token = (authed.auth.token ?? {}) as { role?: string };
  if (token.role === 'admin') {
    next();
    return;
  }

  // Fallback: Firestore usuarios/{uid}.rol
  try {
    const snap = await db().collection('usuarios').doc(authed.auth.uid).get();
    if (snap.exists && snap.data()?.rol === 'admin') {
      next();
      return;
    }
  } catch {
    // fallthrough a 403
  }

  sendError(res, 403, 'permission-denied', 'Solo administradores pueden realizar esta acción');
}

// ── Cron secret (constant-time) ─────────────────────────────────────────

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function verifyCronSecret(req: Request): void {
  const expected = CRON_SECRET();
  const received = (req.headers['x-cron-secret'] as string) || '';
  if (!expected || !safeEqual(received, expected)) {
    throw new APIError('unauthenticated', 'Secreto inválido');
  }
}

// ── Error middleware ────────────────────────────────────────────────────

export function errorMiddleware(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof APIError) {
    sendError(res, errorStatusFor(err.code), err.code, err.message);
    return;
  }

  // JSON malformed
  const e = err as { type?: string } | null;
  if (e && e.type === 'entity.parse.failed') {
    sendError(res, 400, 'invalid-argument', 'Body inválido: JSON mal formado');
    return;
  }

  console.error('Unhandled error:', err);
  sendError(res, 500, 'internal', 'Error interno del servidor');
}