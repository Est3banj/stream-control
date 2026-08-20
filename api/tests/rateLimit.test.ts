/**
 * Tests del rate-limit transaccional (AD-4): checkAndIncrement unit + wiring en registry
 * (validarToken 30/60s, correos email 1/60s, consultarCodigoDirecto uid 10/cuenta 5).
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { checkAndIncrement } from '../src/rateLimit.js';
import { createApp } from '../src/app.js';

vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());
vi.mock('../src/imap.js', () => ({
  buscarCodigoVerificacion: vi.fn(async () => ({ codigo: '123', fecha: new Date().toISOString(), tipo: 'viajenet' })),
}));

const app = createApp();
const TK = 'tk-ratelimit';

beforeEach(() => {
  backend.reset();
  backend.auth.setToken(TK, { uid: 'uid-1' });
});

describe('checkAndIncrement (unit, Firestore transaccional)', () => {
  it('permite hasta max y bloquea el siguiente', async () => {
    const ok = (i: number) => checkAndIncrement('test', `k-${i}`, 3, 60_000, 'limite');
    expect(ok(1)).resolves.toBeUndefined();
    expect(ok(1)).resolves.toBeUndefined();
    expect(ok(1)).resolves.toBeUndefined();
    await expect(ok(1)).rejects.toThrow('limite');
  });

  it('ventana vencida → reinicia contador (rollover)', async () => {
    backend.seed('rate_limits', 'test:key', { count: 3, windowStart: Date.now() - 120_000 });
    await expect(checkAndIncrement('test', 'key', 3, 60_000, 'limite')).resolves.toBeUndefined();
    // El conteo siguió avanzando dentro de la nueva ventana
    const doc = backend.getData('rate_limits', 'test:key')!;
    expect(doc.count).toBe(1);
  });

  it('claves distintas → contadores independientes', async () => {
    await checkAndIncrement('test', 'a', 1, 60_000, 'limite');
    await expect(checkAndIncrement('test', 'b', 1, 60_000, 'limite')).resolves.toBeUndefined();
    await expect(checkAndIncrement('test', 'a', 1, 60_000, 'limite')).rejects.toThrow('limite');
  });
});

describe('rate-limit wiring en registry', () => {
  it('enviarCorreoRecuperacion: mismo email → 2da llamada 429', async () => {
    const first = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'mismo@example.com' } });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'mismo@example.com' } });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('resource-exhausted');
    expect(second.body.error.message).toContain('Esperá un minuto');
  });

  it('validarToken: >30 consultas al mismo token en 60s → 429', async () => {
    backend.seed('tokens', 'tok-rl', { activo: true, expiraEn: new Date(Date.now() + 86400000).toISOString(), cuentaId: 'c1' });

    let status = 200;
    for (let i = 0; i < 31; i++) {
      const res = await request(app).post('/api/validarToken').send({ data: { token: 'tok-rl' } });
      status = res.status;
    }
    expect(status).toBe(429);
    // El 31° se bloqueó ANTES de escribir → quedan 30 conteos (max permitido)
    expect(backend.getData('rate_limits', 'token:tok-rl')?.count).toBe(30);
  });

  it('consultarCodigoDirecto: uid 10/min y cuenta 5/min independientes', async () => {
    backend.seed('cuentas', 'c-a', { propietarioId: 'uid-1', proveedor: 'Netflix' });
    backend.seed('cuentas_secretos', 'c-a', { correo: 'imap@example.com', contrasena: 'x' });
    backend.seed('cuentas', 'c-b', { propietarioId: 'uid-1', proveedor: 'Win' });
    backend.seed('cuentas_secretos', 'c-b', { correo: 'imap@example.com2', contrasena: 'y' });

    // cuenta c-a: 5 llamadas OK, 6ta → 429 (cuenta 5/min)
    let status = 200;
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/consultarCodigoDirecto')
        .set('Authorization', `Bearer ${TK}`)
        .send({ data: { cuentaId: 'c-a', caso: 'viajenet' } });
      status = res.status;
    }
    expect(status).toBe(429);
    expect(backend.getData('rate_limits', 'cuenta:c-a')?.count).toBe(5);
    // El 6° incrementó el uid scope antes de bloquearse en el scope cuenta (orden del registry)
    expect(backend.getData('rate_limits', 'uid:uid-1')?.count).toBe(6);
  });
});