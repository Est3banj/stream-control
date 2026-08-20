/**
 * Tests CORS (REQ-AS-001 / AD-1): preflight 204+ACAO exacto, origin ajeno → sin ACAO,
 * POST real de origin ajeno → 403 SIN ejecutar handler.
 */

import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { createApp } from '../src/app.js';
import type { RouteDef } from '../src/registry.js';

vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());

const ALLOWED = 'https://streamcontrol.pro';

// Hosting sirve la SPA en los 3 dominios canónicos (verificado HTTP 200):
const HOSTING_ORIGINS = [
  'https://streamcontrol.pro',
  'https://streamcontrol-10837.web.app',
  'https://streamcontrol-10837.firebaseapp.com',
];

function corsApp(handlerSpy?: () => Promise<unknown>) {
  const registry: Record<string, RouteDef> = {
    echo: { auth: 'none', handler: (handlerSpy ?? (async () => ({ ok: true }))) as RouteDef['handler'] },
  };
  return createApp(registry);
}

describe('CORS estricto', () => {
  it('preflight OPTIONS desde streamcontrol.pro → 204 con ACAO exacto', async () => {
    const app = corsApp();
    const res = await request(app)
      .options('/api/echo')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('preflight OPTIONS desde origin ajeno → SIN ACAO (navegador bloquea)', async () => {
    const app = corsApp();
    const res = await request(app)
      .options('/api/echo')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('POST real desde origin ajeno → 403 sin ACAO y SIN ejecutar handler', async () => {
    const spy = vi.fn(async () => ({ ok: true }));
    const app = corsApp(spy);
    const res = await request(app)
      .post('/api/echo')
      .set('Origin', 'https://evil.example')
      .send({ data: { x: 1 } });
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('POST sin header Origin (curl/server) → pasa sin ACAO', async () => {
    const app = corsApp();
    const res = await request(app).post('/api/echo').send({ data: { x: 1 } });
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.body).toEqual({ result: { ok: true } });
  });

  it('POST desde origen permitido → ACAO presente y 200', async () => {
    const app = corsApp();
    const res = await request(app)
      .post('/api/echo')
      .set('Origin', ALLOWED)
      .send({ data: { x: 1 } });
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it.each(HOSTING_ORIGINS)('preflight OPTIONS desde %s → 204 con ACAO exacto', async (origin) => {
    const app = corsApp();
    const res = await request(app)
      .options('/api/echo')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it.each(HOSTING_ORIGINS)('POST real desde %s → 200 con ACAO exacto', async (origin) => {
    const app = corsApp();
    const res = await request(app)
      .post('/api/echo')
      .set('Origin', origin)
      .send({ data: { x: 1 } });
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('variante con subdominio falso (x-streamcontrol.pro) → SIN ACAO', async () => {
    const app = corsApp();
    const res = await request(app)
      .options('/api/echo')
      .set('Origin', 'https://x-streamcontrol.pro')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});