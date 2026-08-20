/**
 * Tests de contrato envelope (AD-9 / REQ-BE-002):
 * 200 {result}, 404 fn desconocida, body sin data → invalid-argument,
 * forma del envelope de error, tabla de mapping code→HTTP, error 500 genérico.
 * Usa registry PARCIAL — no toca Firebase.
 */

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { createApp } from '../src/app.js';
import { APIError } from '../src/errors.js';
import type { RouteDef } from '../src/registry.js';

vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());

function partialRegistry(): Record<string, RouteDef> {
  return {
    ping: {
      auth: 'none',
      handler: async () => ({ pong: true }),
    },
    throwNotFound: {
      auth: 'none',
      handler: async () => {
        throw new APIError('not-found', 'Nope not found');
      },
    },
    throwUnauthenticated: {
      auth: 'none',
      handler: async () => {
        throw new APIError('unauthenticated', 'Debes iniciar sesión');
      },
    },
    throwPermission: {
      auth: 'none',
      handler: async () => {
        throw new APIError('permission-denied', 'No tienes permisos');
      },
    },
    throwExhausted: {
      auth: 'none',
      handler: async () => {
        throw new APIError('resource-exhausted', 'Demasiadas consultas');
      },
    },
    throwInvalidArgument: {
      auth: 'none',
      handler: async () => {
        throw new APIError('invalid-argument', 'Argumento inválido');
      },
    },
    throwUnavailable: {
      auth: 'none',
      handler: async () => {
        throw new APIError('unavailable', 'No se pudo conectar');
      },
    },
    throwInternal: {
      auth: 'none',
      handler: async () => {
        throw new Error('boom crudo — sin APIError');
      },
    },
  };
}

const app = createApp(partialRegistry());

describe('envelope callable (registry parcial)', () => {
  it('200 con {result} para fn registrada', async () => {
    const res = await request(app).post('/api/ping').send({ data: {} });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: { pong: true } });
  });

  it('404 envelope para fn desconocida', async () => {
    const res = await request(app).post('/api/noExiste').send({ data: {} });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not-found', message: 'Función no encontrada' } });
  });

  it('404 envelope para GET en /api/* (solo POST)', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not-found');
  });

  it('body sin campo data → invalid-argument (sin 500 crudo)', async () => {
    const res = await request(app).post('/api/ping').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'invalid-argument', message: 'Body debe contener el campo data' } });
  });

  it('JSON malformado → 400 invalid-argument', async () => {
    const res = await request(app)
      .post('/api/ping')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid-argument');
  });

  it('data:null es válido (handlers que no usan payload)', async () => {
    const res = await request(app).post('/api/ping').send({ data: null });
    expect(res.status).toBe(200);
  });
});

describe('error mapping code → HTTP status (todo el mapa)', () => {
  const cases: Array<[string, string, number]> = [
    ['throwInvalidArgument', 'invalid-argument', 400],
    ['throwUnauthenticated', 'unauthenticated', 401],
    ['throwPermission', 'permission-denied', 403],
    ['throwNotFound', 'not-found', 404],
    ['throwExhausted', 'resource-exhausted', 429],
    ['throwUnavailable', 'unavailable', 503],
  ];

  for (const [fn, code, status] of cases) {
    it(`${fn} → ${status} {error:{code:'${code}'}}`, async () => {
      const res = await request(app).post(`/api/${fn}`).send({ data: {} });
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(code);
      expect(typeof res.body.error.message).toBe('string');
    });
  }

  it('error crudo (sin APIError) → 500 {error:{code:"internal"}}', async () => {
    const res = await request(app).post('/api/throwInternal').send({ data: {} });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal');
  });
});