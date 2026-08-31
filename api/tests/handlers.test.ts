/**
 * Tests de handlers con Firestore fake (AD-9) + nodemailer mockeado.
 * Triggers (claim transaccional), desasignar, desvincular, correos, listarVerificados (admin)
 * y cleanupNoVerificados (cron).
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { createApp } from '../src/app.js';

const emailMocks = vi.hoisted(() => {
  const sendMail = vi.fn(async (_mail: unknown) => ({ accepted: ['test@example.com'] }));
  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail })),
  };
});

vi.mock('nodemailer', () => ({
  default: { createTransport: emailMocks.createTransport },
  createTransport: emailMocks.createTransport,
}));
vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());

const app = createApp();

const TK = 'tk-handlers';

beforeEach(() => {
  backend.reset();
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_TOKEN;
  delete process.env.CRON_SECRET;
  process.env.SMTP_USER = 'smtp@example.com';
  process.env.SMTP_PASS = 'smtp-pass';
  emailMocks.sendMail.mockClear();
  emailMocks.createTransport.mockClear();
});

describe('onNuevoUsuario (trigger bearer, claim transaccional)', () => {
  beforeEach(() => {
    backend.auth.setToken(TK, { uid: 'uid-1' });
  });

  it('envía welcome y marca emailBienvenidaEnviado', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana', correo: 'ana@example.com' });

    const res = await request(app)
      .post('/api/onNuevoUsuario')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true });
    expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
    expect(emailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@example.com' }));
    expect(backend.getData('usuarios', 'uid-1')?.emailBienvenidaEnviado).toBe(true);
  });

  it('idempotente: si emailBienvenidaEnviado=true → skipped sin reenviar', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana', correo: 'ana@example.com', emailBienvenidaEnviado: true });

    const res = await request(app)
      .post('/api/onNuevoUsuario')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });

    expect(res.status).toBe(200);
    expect(res.body.result.skipped).toBe(true);
    expect(emailMocks.sendMail).not.toHaveBeenCalled();
  });

  it('usuario sin correo → skipped sin romper', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });

    const res = await request(app)
      .post('/api/onNuevoUsuario')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });

    expect(res.status).toBe(200);
    expect(res.body.result.skipped).toBe(true);
    expect(emailMocks.sendMail).not.toHaveBeenCalled();
  });

  it('usuario inexistente → success sin claim', async () => {
    const res = await request(app)
      .post('/api/onNuevoUsuario')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });

    expect(res.status).toBe(200);
    expect(emailMocks.sendMail).not.toHaveBeenCalled();
  });

  it('sin bearer → 401 unauthenticated', async () => {
    const res = await request(app).post('/api/onNuevoUsuario').send({ data: {} });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });
});

describe('onNotificacionEmail (trigger bearer, claim transaccional)', () => {
  beforeEach(() => {
    backend.auth.setToken(TK, { uid: 'uid-1' });
  });

  it('password_changed → envía y marca procesadoEnviado', async () => {
    backend.seed('notificacionesEmail', 'notif-1', {
      uid: 'uid-1',
      tipo: 'password_changed',
      nombre: 'Ana',
      correo: 'ana@example.com',
    });

    const res = await request(app)
      .post('/api/onNotificacionEmail')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { notificacionId: 'notif-1' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true });
    expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
    expect(emailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@example.com' }));
    expect(backend.getData('notificacionesEmail', 'notif-1')?.procesadoEnviado).toBe(true);
  });

  it('segunda invocación → alreadyProcessed sin reenviar', async () => {
    backend.seed('notificacionesEmail', 'notif-1', {
      uid: 'uid-1',
      tipo: 'password_changed',
      nombre: 'Ana',
      correo: 'ana@example.com',
      procesadoEnviado: true,
    });

    const res = await request(app)
      .post('/api/onNotificacionEmail')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { notificacionId: 'notif-1' } });

    expect(res.status).toBe(200);
    expect(res.body.result.alreadyProcessed).toBe(true);
    expect(emailMocks.sendMail).not.toHaveBeenCalled();
  });

  it('doc de otro usuario → 403 permission-denied', async () => {
    backend.seed('notificacionesEmail', 'notif-1', { uid: 'uid-otro', tipo: 'password_changed' });

    const res = await request(app)
      .post('/api/onNotificacionEmail')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { notificacionId: 'notif-1' } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('email_changed → usa nuevoCorreo', async () => {
    backend.seed('notificacionesEmail', 'notif-2', {
      uid: 'uid-1',
      tipo: 'email_changed',
      nombre: 'Ana',
      nuevoCorreo: 'nueva@example.com',
    });

    const res = await request(app)
      .post('/api/onNotificacionEmail')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { notificacionId: 'notif-2' } });

    expect(res.status).toBe(200);
    expect(emailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'nueva@example.com' }));
  });

  it('notificacionId faltante → 400; inexistente → 404', async () => {
    const noId = await request(app)
      .post('/api/onNotificacionEmail')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });
    expect(noId.status).toBe(400);

    const noDoc = await request(app)
      .post('/api/onNotificacionEmail')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { notificacionId: 'zzz' } });
    expect(noDoc.status).toBe(404);
    expect(noDoc.body.error.code).toBe('not-found');
  });
});

describe('desasignarPerfil (bearer)', () => {
  beforeEach(() => {
    backend.auth.setToken(TK, { uid: 'uid-1' });
  });

  const seedCuenta = (estado = 'asignada') =>
    backend.seed('cuentas', 'c1', {
      propietarioId: 'uid-1',
      proveedor: 'Netflix',
      estado,
      perfiles: [
        { nombre: 'netflix1', pin: '1234', estado: 'asignado', clienteNombre: 'Ana', fechaAsignacion: '2026-01-01' },
        { nombre: 'netflix2', pin: '5678', estado: 'disponible' },
      ],
    });

  it('desasigna y limpia cliente + cuenta', async () => {
    seedCuenta();
    backend.seed('clientes', 'cl-1', { nombre: 'Ana', cuentaId: 'c1', perfilAsignado: 'netflix1' });

    const res = await request(app)
      .post('/api/desasignarPerfil')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { clienteId: 'cl-1', cuentaId: 'c1', perfilNombre: 'netflix1' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true, perfilNombre: 'netflix1', cuentaId: 'c1' });

    const cuenta = backend.getData('cuentas', 'c1')!;
    expect(cuenta.estado).toBe('disponible');
    const perfil = (cuenta.perfiles as Array<Record<string, unknown>>)[0];
    expect(perfil.estado).toBe('disponible');
    expect(perfil.clienteNombre).toBeUndefined();
    expect(perfil.fechaAsignacion).toBeUndefined();

    const cliente = backend.getData('clientes', 'cl-1')!;
    expect(cliente.cuentaId).toBeUndefined();
    expect(cliente.perfilAsignado).toBeUndefined();
  });

  it('cuenta de otro propietario → 403', async () => {
    backend.seed('cuentas', 'c2', {
      propietarioId: 'uid-otro',
      estado: 'asignada',
      perfiles: [{ nombre: 'p1', estado: 'asignado', clienteNombre: 'X' }],
    });

    const res = await request(app)
      .post('/api/desasignarPerfil')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { clienteId: 'cl-1', cuentaId: 'c2', perfilNombre: 'p1' } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('cuenta inexistente → 404; faltan campos → 400', async () => {
    const noCuenta = await request(app)
      .post('/api/desasignarPerfil')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { clienteId: 'cl-1', cuentaId: 'zzz', perfilNombre: 'p1' } });
    expect(noCuenta.status).toBe(404);

    const sinCampos = await request(app)
      .post('/api/desasignarPerfil')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { clienteId: 'cl-1' } });
    expect(sinCampos.status).toBe(400);
    expect(sinCampos.body.error.code).toBe('invalid-argument');
  });
});

describe('desvincularTelegram (bearer)', () => {
  beforeEach(() => {
    backend.auth.setToken(TK, { uid: 'uid-1' });
  });

  it('sin vinculaciones → alreadyUnlinked', async () => {
    const res = await request(app)
      .post('/api/desvincularTelegram')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true, alreadyUnlinked: true });
  });

  it('elimina las vinculaciones del uid', async () => {
    backend.seed('vinculaciones', 'v1', { uid: 'uid-1', chatId: 111 });
    backend.seed('vinculaciones', 'v2', { uid: 'uid-1', chatId: 222 });
    backend.seed('vinculaciones', 'v3', { uid: 'uid-otro', chatId: 333 });

    const res = await request(app)
      .post('/api/desvincularTelegram')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true, multipleDeleted: true });
    expect(backend.getData('vinculaciones', 'v1')).toBeUndefined();
    expect(backend.getData('vinculaciones', 'v2')).toBeUndefined();
    expect(backend.getData('vinculaciones', 'v3')).toBeDefined();
  });
});

describe('enviarCorreoRecuperacion / enviarCorreoVerificacion (none + rate-limit 1/60s en registry)', () => {
  it('recuperación → 200 y envía con link de reset', async () => {
    const res = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'ana@example.com', nombre: 'Ana' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true });
    expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
    const call = emailMocks.sendMail.mock.calls[0]?.[0] as { to?: string; html?: string } | undefined;
    expect(call?.to).toBe('ana@example.com');
    expect(call?.html).toContain('https://reset.example/link');
  });

  it('recuperación sin email → 400', async () => {
    const res = await request(app).post('/api/enviarCorreoRecuperacion').send({ data: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid-argument');
  });

  it('verificación → 200 y genera link con token', async () => {
    const res = await request(app)
      .post('/api/enviarCorreoVerificacion')
      .send({ data: { email: 'ana@example.com' } });

    expect(res.status).toBe(200);
    const html = (emailMocks.sendMail.mock.calls[0]?.[0] as { html?: string } | undefined)?.html ?? '';
    expect(html).toContain('/r/verificar-email?token=');
  });

  it('verificación en dev mode (sin SMTP_USER / SMTP_PASS) → 200 con graceful fallback sin llamar sendMail', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await request(app)
      .post('/api/enviarCorreoVerificacion')
      .send({ data: { email: 'dev@example.com' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true });
    expect(emailMocks.sendMail).not.toHaveBeenCalled();

    const loggedOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(loggedOutput).toContain('🔗 [DEV MODE] Link de verificación para dev@example.com:');
    expect(loggedOutput).toContain('/r/verificar-email?token=');

    consoleSpy.mockRestore();
  });
});

describe('listarVerificados (admin)', () => {
  beforeEach(() => {
    backend.auth.setToken(TK, { uid: 'uid-1' });
    backend.auth.setToken('tk-admin', { uid: 'uid-admin', role: 'admin' });
  });

  it('claim admin → devuelve mapa uid → emailVerified', async () => {
    backend.auth.addAuthUser({ uid: 'u-verif', emailVerified: true, providerData: [{ providerId: 'password' }], metadata: {} });
    backend.auth.addAuthUser({ uid: 'u-noverif', emailVerified: false, providerData: [{ providerId: 'password' }], metadata: {} });

    const res = await request(app)
      .post('/api/listarVerificados')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: {} });

    expect(res.status).toBe(200);
    expect(res.body.result.verificados).toMatchObject({ 'u-verif': true, 'u-noverif': false });
  });

  it('fallback Firestore: rol admin en usuarios/{uid} → 200', async () => {
    backend.seed('usuarios', 'uid-1', { rol: 'admin' });

    const res = await request(app)
      .post('/api/listarVerificados')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });

    expect(res.status).toBe(200);
  });

  it('sin claim admin ni rol en Firestore → 403', async () => {
    const res = await request(app)
      .post('/api/listarVerificados')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('sin bearer → 401', async () => {
    const res = await request(app).post('/api/listarVerificados').send({ data: {} });
    expect(res.status).toBe(401);
  });
});

describe('cleanupNoVerificados (cron, x-cron-secret)', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const viejo = new Date(Date.now() - 30 * DAY).toISOString();
  const reciente = new Date(Date.now() - 1 * DAY).toISOString();

  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret-42';
  });

  it('sin x-cron-secret → 401 unauthenticated', async () => {
    const res = await request(app).post('/api/cleanupNoVerificados').send({ data: {} });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('elimina solo >3 días sin verificar con provider password (no admins)', async () => {
    backend.auth.addAuthUser({ uid: 'u-old', emailVerified: false, providerData: [{ providerId: 'password' }], metadata: { creationTime: viejo } });
    backend.auth.addAuthUser({ uid: 'u-admin', emailVerified: false, providerData: [{ providerId: 'password' }], metadata: { creationTime: viejo } });
    backend.auth.addAuthUser({ uid: 'u-recent', emailVerified: false, providerData: [{ providerId: 'password' }], metadata: { creationTime: reciente } });
    backend.auth.addAuthUser({ uid: 'u-verified', emailVerified: true, providerData: [{ providerId: 'password' }], metadata: { creationTime: viejo } });
    backend.auth.addAuthUser({ uid: 'u-google', emailVerified: false, providerData: [{ providerId: 'google.com' }], metadata: { creationTime: viejo } });
    backend.seed('usuarios', 'u-admin', { rol: 'admin' });

    const res = await request(app)
      .post('/api/cleanupNoVerificados')
      .set('x-cron-secret', process.env.CRON_SECRET!)
      .send({ data: {} });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ eliminados: 1, candidatos: 2 }); // u-old eliminado; u-admin candidato exento
    expect(backend.auth.deleteUser).toHaveBeenCalledWith('u-old');
    expect(backend.auth.deleteUser).not.toHaveBeenCalledWith('u-admin');
  });
});