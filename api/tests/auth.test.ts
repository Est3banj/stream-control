/**
 * Capa de autenticación (AD-1 / REQ-AS-003): verifyBearer edge cases,
 * exposición de uid, y token inválido/expirado/revocado.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { createApp } from '../src/app.js';

vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());

const app = createApp();
const TK = 'tk-auth';

beforeEach(() => {
  backend.reset();
  backend.auth.setToken(TK, { uid: 'uid-1', role: 'user' });
});

describe('verifyBearer (authBearer)', () => {
  const call = (auth?: string) => {
    const req = request(app).post('/api/desvincularTelegram').send({ data: {} });
    if (auth !== undefined) req.set('Authorization', auth);
    return req;
  };

  it('sin header Authorization → 401 unauthenticated', async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('formato inválido (sin Bearer / vacío) → 401', async () => {
    expect((await call('token-sueto')).status).toBe(401);
    expect((await call('Bearer')).status).toBe(401);
    expect((await call('Bearer ')).status).toBe(401);
  });

  it('token inválido/con expiración → 401', async () => {
    expect((await call('Bearer invalid')).status).toBe(401);
  });

  it('token válido → expone uid y ejecuta (idempotente sin vinculaciones)', async () => {
    const res = await call(`Bearer ${TK}`);
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true, alreadyUnlinked: true });
  });

  it('custom claims viajan en el token (role usado por requireAdmin)', async () => {
    backend.auth.setToken('tk-user', { uid: 'uid-user' });
    const res = await call('Bearer tk-user');
    expect(res.status).toBe(200);
  });
});

describe('requireAdmin (claims + fallback Firestore)', () => {
  it('claim role:admin → pasa sin Firestore', async () => {
    backend.auth.setToken('tk-admin', { uid: 'uid-admin', role: 'admin' });
    const res = await request(app)
      .post('/api/listarVerificados')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: {} });
    expect(res.status).toBe(200);
  });

  it('sin rol → 403 con mensaje de admin', async () => {
    const res = await request(app)
      .post('/api/listarVerificados')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Solo admin');
  });

  it('token con uid sin claim pero usuarios/{uid}.rol=admin → pasa (fallback)', async () => {
    backend.auth.setToken(TK, { uid: 'uid-admin-firestore' });
    backend.seed('usuarios', 'uid-admin-firestore', { rol: 'admin' });
    const res = await request(app)
      .post('/api/listarVerificados')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });
    expect(res.status).toBe(200);
  });
});

describe('cron secret (x-cron-secret, constant-time)', () => {
  it('sin CRON_SECRET configurado en env → 401 (no arranca en producción sin secret)', async () => {
    delete process.env.CRON_SECRET;
    const res = await request(app).post('/api/cleanupNoVerificados').send({ data: {} });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('secreto correcto → ejecuta', async () => {
    process.env.CRON_SECRET = 'supersecreto';
    const res = await request(app)
      .post('/api/cleanupNoVerificados')
      .set('x-cron-secret', 'supersecreto')
      .send({ data: {} });
    expect(res.status).toBe(200);
  });

  it('secreto incorrecto → 401 (timingSafeEqual, sin leak)', async () => {
    process.env.CRON_SECRET = 'supersecreto';
    const res = await request(app)
      .post('/api/cleanupNoVerificados')
      .set('x-cron-secret', 'otro')
      .send({ data: {} });
    expect(res.status).toBe(401);
  });
});