/**
 * Factory de la app Express (AD-1).
 * Middleware order: CORS → express.json({limit:'1mb'}) → dispatch por registry → envelope → error middleware.
 * POST /api/:fn únicamente; fn desconocida → 404 envelope; GET a /api/* → 404 envelope.
 */

import express from 'express';
import { APIError, errorEnvelope } from './errors.js';
import { db } from './firebase.js';
import { corsMiddleware, errorMiddleware, verifyBearer, verifyCronSecret } from './middleware.js';
import { checkAndIncrement } from './rateLimit.js';
import { FN_REGISTRY, type RouteDef } from './registry.js';

type AuthedReq = express.Request & {
  auth?: { uid: string; token: Record<string, unknown> };
  data?: unknown;
};

export function createApp(registry: Record<string, RouteDef> = FN_REGISTRY): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/:fn', async (req, res, next) => {
    try {
      const fn = req.params.fn;
      const def = registry[fn];

      if (!def) {
        res.status(404).json(errorEnvelope('not-found', 'Función no encontrada'));
        return;
      }

      // ── Seguridad según flag del registry ──
      if (def.auth === 'bearer' || def.auth === 'admin') {
        (req as AuthedReq).auth = await verifyBearer(req);
      } else if (def.auth === 'none' && req.headers.authorization) {
        try {
          (req as AuthedReq).auth = await verifyBearer(req);
        } catch {
          // Token opcional: si falla o expira, ignorar para auth: 'none'
        }
      }
      if (def.auth === 'admin') {
        const authed = req as AuthedReq;
        const token = authed.auth!.token as { role?: string };
        if (token.role !== 'admin') {
          // Fallback: Firestore usuarios/{uid}.rol (parity v2 index.ts:586-592)
          const snap = await db().collection('usuarios').doc(authed.auth!.uid).get();
          if (!snap.exists || snap.data()?.rol !== 'admin') {
            throw new APIError('permission-denied', 'Solo administradores pueden realizar esta acción');
          }
        }
      }
      if (def.auth === 'cron') {
        verifyCronSecret(req);
      }

      // ── Body envelope callable: { data } ──
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (def.raw) {
        (req as AuthedReq).data = body;
      } else if (!('data' in body)) {
        // REQ-BE-002: body sin campo data → invalid-argument, sin 500 crudo
        throw new APIError('invalid-argument', 'Body debe contener el campo data');
      } else {
        (req as AuthedReq).data = body.data ?? null;
      }

      // ── Rate-limits (Firestore transaccional) ──
      // DESPUÉS del parseo de body: las keys del registry leen req.data.
      if (def.rateLimits) {
        for (const rule of def.rateLimits) {
          await checkAndIncrement(rule.scope, rule.key(req), rule.max, rule.windowMs, rule.message);
        }
      }

      // Raw (telegramWebhook): el handler maneja la respuesta directamente, sin envelope
      if (def.raw) {
        await def.handler(req, res);
        return;
      }

      const result = await def.handler(req, res);
      if (!res.writableEnded) {
        res.status(200).json({ result });
      }
    } catch (err) {
      next(err);
    }
  });

  // Cualquier otra ruta/método → 404 envelope
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json(errorEnvelope('not-found', 'Función no encontrada'));
    } else {
      res.status(404).json(errorEnvelope('not-found', 'Not Found'));
    }
  });

  app.use(errorMiddleware);

  return app;
}