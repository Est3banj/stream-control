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
  it('recuperación → 200 y envía con link de reset directo a /app/reset-password', async () => {
    const res = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'ana@example.com', nombre: 'Ana' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace de recuperación.',
    });
    expect(backend.auth.generatePasswordResetLink).toHaveBeenCalledWith(
      'ana@example.com',
      expect.objectContaining({ url: expect.stringContaining('/app/reset-password') })
    );
    expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
    const call = emailMocks.sendMail.mock.calls[0]?.[0] as { to?: string; html?: string } | undefined;
    expect(call?.to).toBe('ana@example.com');
    expect(call?.html).toContain('/app/reset-password?oobCode=fake-oob-code-123&apiKey=fake-api-key-456');
  });

  it('recuperación con APP_URL con trailing slash normaliza la URL correctamente', async () => {
    process.env.APP_URL = 'https://streamcontrol.pro/';
    const res = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'maria@example.com', nombre: 'Maria' } });

    expect(res.status).toBe(200);
    const call = emailMocks.sendMail.mock.calls[0]?.[0] as { to?: string; html?: string } | undefined;
    expect(call?.html).toContain('https://streamcontrol.pro/app/reset-password?oobCode=fake-oob-code-123');
    expect(call?.html).not.toContain('https://streamcontrol.pro//');
    delete process.env.APP_URL;
  });

  it('recuperación con email no registrado (auth/user-not-found) → 200 sin filtrar existencia ni crashear (OWASP)', async () => {
    backend.auth.generatePasswordResetLink.mockRejectedValueOnce({
      code: 'auth/user-not-found',
      message: 'There is no user record corresponding to the provided identifier.',
    });

    const res = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'no-existe@example.com', nombre: 'Desconocido' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace de recuperación.',
    });
    expect(emailMocks.sendMail).not.toHaveBeenCalled();
  });

  it('recuperación con error INTERNAL ASSERT FAILED / EMAIL_NOT_FOUND → 200 OWASP', async () => {
    backend.auth.generatePasswordResetLink.mockRejectedValueOnce(
      new Error('INTERNAL ASSERT FAILED: Unable to create the email action link')
    );

    const res = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'no-existe2@example.com', nombre: 'Desconocido' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace de recuperación.',
    });
    expect(emailMocks.sendMail).not.toHaveBeenCalled();
  });

  it('recuperación con error de continue-uri (auth/unauthorized-continue-uri) → fallback a generatePasswordResetLink sin settings', async () => {
    backend.auth.generatePasswordResetLink
      .mockRejectedValueOnce({
        code: 'auth/unauthorized-continue-uri',
        message: 'Domain not authorized for continue URL',
      })
      .mockResolvedValueOnce('https://streamcontrol-10837.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=fallback-oob-999&apiKey=fallback-api-key-888');

    const res = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'fallback@example.com', nombre: 'Fallback User' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({
      success: true,
      message: 'Si el correo está registrado, recibirás un enlace de recuperación.',
    });
    expect(backend.auth.generatePasswordResetLink).toHaveBeenCalledTimes(2);
    // Primera llamada con actionCodeSettings
    expect(backend.auth.generatePasswordResetLink).toHaveBeenNthCalledWith(
      1,
      'fallback@example.com',
      expect.objectContaining({ url: expect.stringContaining('/app/reset-password') })
    );
    // Segunda llamada sin actionCodeSettings (fallback)
    expect(backend.auth.generatePasswordResetLink).toHaveBeenNthCalledWith(2, 'fallback@example.com');

    expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
    const call = emailMocks.sendMail.mock.calls[0]?.[0] as { to?: string; html?: string } | undefined;
    expect(call?.to).toBe('fallback@example.com');
    expect(call?.html).toContain('/app/reset-password?oobCode=fallback-oob-999&apiKey=fallback-api-key-888');
  });

  it('recuperación con email de formato inválido (auth/invalid-email) → 400 invalid-argument', async () => {
    backend.auth.generatePasswordResetLink.mockRejectedValueOnce({
      code: 'auth/invalid-email',
      message: 'The email address is improperly formatted.',
    });

    const res = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'formato-invalido', nombre: 'Invalido' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid-argument');
    expect(emailMocks.sendMail).not.toHaveBeenCalled();
  });

  it('recuperación cuando falla el envío de email → 500 internal', async () => {
    emailMocks.sendMail.mockRejectedValueOnce(new Error('SMTP connection error'));

    const res = await request(app)
      .post('/api/enviarCorreoRecuperacion')
      .send({ data: { email: 'smtp-fail@example.com', nombre: 'Fail User' } });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal');
    expect(res.body.error.message).toBe('Error al enviar el correo de recuperación');
  });

  it('recuperación sin email → 400', async () => {
    const res = await request(app).post('/api/enviarCorreoRecuperacion').send({ data: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid-argument');
  });
});

describe('notificarPasswordReseteado (none + rate-limit en registry)', () => {
  it('envía notificación de contraseña cambiada con nombre provisto', async () => {
    const res = await request(app)
      .post('/api/notificarPasswordReseteado')
      .send({ data: { email: 'carlos@example.com', nombre: 'Carlos' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true });
    expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
    const call = emailMocks.sendMail.mock.calls[0]?.[0] as { to?: string; html?: string; subject?: string } | undefined;
    expect(call?.to).toBe('carlos@example.com');
    expect(call?.subject).toContain('Tu contraseña fue cambiada');
    expect(call?.html).toContain('Carlos');
  });

  it('busca nombre en Firestore si no se pasa nombre explícito', async () => {
    backend.seed('usuarios', 'uid-carlos', { nombre: 'Carlos Firestore', correo: 'carlos@example.com' });

    const res = await request(app)
      .post('/api/notificarPasswordReseteado')
      .send({ data: { email: 'carlos@example.com' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true });
    expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
    const call = emailMocks.sendMail.mock.calls[0]?.[0] as { to?: string; html?: string } | undefined;
    expect(call?.html).toContain('Carlos Firestore');
  });

  it('notificarPasswordReseteado sin email → 400 invalid-argument', async () => {
    const res = await request(app).post('/api/notificarPasswordReseteado').send({ data: {} });
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

  it('alias enviarVerificacionEmail → 200 y delega correctamente', async () => {
    const res = await request(app)
      .post('/api/enviarVerificacionEmail')
      .send({ data: { email: 'alias@example.com' } });

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
    expect(loggedOutput).toContain('✉️  [DEV MODE EMAIL]');
    expect(loggedOutput).toContain('To: dev@example.com');

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

describe('enviarComunicadoMasivo (admin)', () => {
  beforeEach(() => {
    backend.auth.setToken(TK, { uid: 'uid-user', role: 'user' });
    backend.auth.setToken('tk-admin', { uid: 'uid-admin', role: 'admin' });
  });

  it('sin auth → 401 unauthenticated', async () => {
    const res = await request(app)
      .post('/api/enviarComunicadoMasivo')
      .send({ data: { titulo: 'Promo', mensaje: 'Hola' } });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('usuario no admin → 403 permission-denied', async () => {
    const res = await request(app)
      .post('/api/enviarComunicadoMasivo')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { titulo: 'Promo', mensaje: 'Hola' } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('faltan titulo o mensaje → 400 invalid-argument', async () => {
    const resSinTitulo = await request(app)
      .post('/api/enviarComunicadoMasivo')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: { mensaje: 'Hola' } });
    expect(resSinTitulo.status).toBe(400);
    expect(resSinTitulo.body.error.code).toBe('invalid-argument');

    const resSinMensaje = await request(app)
      .post('/api/enviarComunicadoMasivo')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: { titulo: 'Promo' } });
    expect(resSinMensaje.status).toBe(400);
    expect(resSinMensaje.body.error.code).toBe('invalid-argument');
  });

  it('publica in-app y banner correctamente', async () => {
    const res = await request(app)
      .post('/api/enviarComunicadoMasivo')
      .set('Authorization', 'Bearer tk-admin')
      .send({
        data: {
          titulo: 'Mantenimiento Programado',
          mensaje: 'El sistema entrará en mantenimiento breve.',
          tipo: 'vencimiento',
          linkBoton: 'https://wa.me/573247349128',
          textoBoton: 'Contactar Soporte',
          canales: { inApp: true, banner: true, email: false },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.result.success).toBe(true);
    expect(res.body.result.anuncioId).toBeDefined();

    // Validar in-app en anunciosGlobales
    const anuncioId = res.body.result.anuncioId;
    const guardado = backend.getData('anunciosGlobales', anuncioId);
    expect(guardado).toBeDefined();
    expect(guardado?.titulo).toBe('Mantenimiento Programado');
    expect(guardado?.activo).toBe(true);

    // Validar banner en config/broadcast
    const broadcastDoc = backend.getData('config', 'broadcast');
    expect(broadcastDoc?.activo).toBe(true);
    expect(broadcastDoc?.mensaje).toBe('El sistema entrará en mantenimiento breve.');
  });

  it('envía correo masivo a todos los usuarios con branding Dark SaaS', async () => {
    backend.seed('usuarios', 'u1', { nombre: 'Roberto Gómez', correo: 'roberto@example.com' });
    backend.seed('usuarios', 'u2', { nombre: 'María Pérez', correo: 'maria@example.com' });

    const res = await request(app)
      .post('/api/enviarComunicadoMasivo')
      .set('Authorization', 'Bearer tk-admin')
      .send({
        data: {
          titulo: '¡Nueva Función de Activación Automática!',
          mensaje: 'Descubrí la nueva integración de códigos de TV y perfiles.',
          tipo: 'novedad',
          linkBoton: 'https://streamcontrol.pro',
          textoBoton: 'Ver Novedades',
          segmento: 'todos',
          canales: { inApp: false, banner: false, email: true },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.result.enviados).toBe(2);
    expect(emailMocks.sendMail).toHaveBeenCalledTimes(2);

    const firstCall = emailMocks.sendMail.mock.calls[0]?.[0] as { to?: string; html?: string; subject?: string } | undefined;
    expect(firstCall?.subject).toContain('StreamControl Pro');
    expect(firstCall?.subject).toContain('¡Nueva Función de Activación Automática!');
    expect(firstCall?.html).toContain('StreamControl Pro');
    expect(firstCall?.html).toContain('Nueva Función / Novedad');
    expect(firstCall?.html).toContain('https://streamcontrol.pro');
    expect(firstCall?.html).toContain('Ver Novedades');
  });

  it('filtra usuarios por segmento "activos"', async () => {
    backend.seed('usuarios', 'u1', { nombre: 'Activo 1', correo: 'activo1@example.com' });
    backend.seed('usuarios', 'u2', { nombre: 'Inactivo 2', correo: 'inactivo2@example.com' });

    backend.seed('suscripciones', 'sub1', {
      usuarioId: 'u1',
      usuarioNombre: 'Activo 1',
      usuarioEmail: 'activo1@example.com',
      estado: 'activa',
    });
    backend.seed('suscripciones', 'sub2', {
      usuarioId: 'u2',
      usuarioNombre: 'Inactivo 2',
      usuarioEmail: 'inactivo2@example.com',
      estado: 'cancelada',
    });

    const res = await request(app)
      .post('/api/enviarComunicadoMasivo')
      .set('Authorization', 'Bearer tk-admin')
      .send({
        data: {
          titulo: 'Descuento para suscriptores',
          mensaje: 'Beneficio exclusivo para cuentas activas.',
          tipo: 'promocion',
          segmento: 'activos',
          canales: { inApp: false, banner: false, email: true },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.result.enviados).toBe(1);
    expect(emailMocks.sendMail).toHaveBeenCalledTimes(1);
    const call = emailMocks.sendMail.mock.calls[0]?.[0] as { to?: string } | undefined;
    expect(call?.to).toBe('activo1@example.com');
  });

  it('filtra usuarios por segmento "por_vencer" (≤ 7 días)', async () => {
    const ahoraMs = Date.now();
    const dia3 = ahoraMs + 3 * 86400 * 1000;
    const dia20 = ahoraMs + 20 * 86400 * 1000;

    backend.seed('suscripciones', 'sub-vence', {
      usuarioNombre: 'Por Vencer',
      usuarioEmail: 'vence@example.com',
      estado: 'activa',
      fechaFin: { seconds: Math.floor(dia3 / 1000) },
    });
    backend.seed('suscripciones', 'sub-lejos', {
      usuarioNombre: 'Lejos',
      usuarioEmail: 'lejos@example.com',
      estado: 'activa',
      fechaFin: { seconds: Math.floor(dia20 / 1000) },
    });

    const res = await request(app)
      .post('/api/enviarComunicadoMasivo')
      .set('Authorization', 'Bearer tk-admin')
      .send({
        data: {
          titulo: 'Tu suscripción vence pronto',
          mensaje: 'Renová antes de que finalice tu ciclo.',
          tipo: 'vencimiento',
          segmento: 'por_vencer',
          canales: { email: true },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.result.enviados).toBe(1);
    expect(emailMocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'vence@example.com' }));
  });
});

describe('eliminarUsuarioAdmin (admin)', () => {
  beforeEach(() => {
    backend.auth.setToken('tk-admin', { uid: 'admin-1', role: 'admin' });
    backend.auth.setToken('tk-user', { uid: 'user-normal', role: 'user' });
  });

  it('401 si no hay token de autenticación', async () => {
    const res = await request(app)
      .post('/api/eliminarUsuarioAdmin')
      .send({ data: { uid: 'user-1' } });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('403 si el usuario no es admin', async () => {
    const res = await request(app)
      .post('/api/eliminarUsuarioAdmin')
      .set('Authorization', 'Bearer tk-user')
      .send({ data: { uid: 'user-1' } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('400 si falta el UID a eliminar', async () => {
    const res = await request(app)
      .post('/api/eliminarUsuarioAdmin')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: {} });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid-argument');
  });

  it('impide la auto-eliminación del administrador', async () => {
    const res = await request(app)
      .post('/api/eliminarUsuarioAdmin')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: { uid: 'admin-1' } });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('failed-precondition');
    expect(res.body.error.message).toContain('No podés eliminar tu propia cuenta');
  });

  it('elimina usuario de Auth, Firestore usuarios y suscripciones asociadas', async () => {
    backend.seed('usuarios', 'target-user', { nombre: 'Target', correo: 'target@example.com' });
    backend.seed('suscripciones', 'sub-1', { usuarioId: 'target-user', planNombre: 'Pro' });
    backend.seed('suscripciones', 'sub-2', { propietarioId: 'target-user', planNombre: 'Starter' });
    backend.seed('suscripciones', 'sub-otro', { usuarioId: 'otro-user', planNombre: 'Pro' });

    const res = await request(app)
      .post('/api/eliminarUsuarioAdmin')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: { uid: 'target-user', cascadeTenantData: false } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({
      success: true,
      uid: 'target-user',
      authDeleted: true,
      firestoreUserDeleted: true,
      suscripcionesEliminadas: 2,
      recursosCascadaEliminados: 0,
    });

    expect(backend.auth.deleteUser).toHaveBeenCalledWith('target-user');
    expect(backend.getData('usuarios', 'target-user')).toBeUndefined();
    expect(backend.getData('suscripciones', 'sub-1')).toBeUndefined();
    expect(backend.getData('suscripciones', 'sub-2')).toBeUndefined();
    expect(backend.getData('suscripciones', 'sub-otro')).toBeDefined();
  });

  it('tolera auth/user-not-found y elimina doc de Firestore y suscripciones', async () => {
    backend.seed('usuarios', 'ghost-user', { nombre: 'Fantasma', correo: 'fantasma@example.com' });
    backend.seed('suscripciones', 'sub-ghost', { usuarioId: 'ghost-user' });

    backend.auth.deleteUser.mockRejectedValueOnce({
      code: 'auth/user-not-found',
      message: 'There is no user record corresponding to the provided identifier.',
    });

    const res = await request(app)
      .post('/api/eliminarUsuarioAdmin')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: { uid: 'ghost-user' } });

    expect(res.status).toBe(200);
    expect(res.body.result.authDeleted).toBe(false);
    expect(res.body.result.firestoreUserDeleted).toBe(true);
    expect(res.body.result.suscripcionesEliminadas).toBe(1);
    expect(backend.getData('usuarios', 'ghost-user')).toBeUndefined();
    expect(backend.getData('suscripciones', 'sub-ghost')).toBeUndefined();
  });

  it('elimina recursos en cascada cuando cascadeTenantData=true', async () => {
    backend.seed('usuarios', 'tenant-user', { nombre: 'Tenant Master', correo: 'tenant@example.com' });
    backend.seed('suscripciones', 'sub-t1', { usuarioId: 'tenant-user' });
    backend.seed('clientes', 'cli-1', { propietarioId: 'tenant-user', nombre: 'Cliente 1' });
    backend.seed('cuentas', 'cta-1', { usuarioId: 'tenant-user', servicio: 'Netflix' });
    backend.seed('ventas', 'ven-1', { propietarioId: 'tenant-user', monto: 1000 });
    backend.seed('movimientos', 'mov-1', { propietarioId: 'tenant-user', tipo: 'ingreso' });
    backend.seed('notificaciones', 'not-1', { usuarioId: 'tenant-user', mensaje: 'Hola' });
    backend.seed('codigosVinculacion', 'cod-1', { propietarioId: 'tenant-user', codigo: 'ABC' });
    backend.seed('vinculaciones', 'vin-1', { propietarioId: 'tenant-user', chatId: '123' });

    // Resource from another tenant that should NOT be deleted
    backend.seed('clientes', 'cli-otro', { propietarioId: 'otro-tenant', nombre: 'Cliente Otro' });

    const res = await request(app)
      .post('/api/eliminarUsuarioAdmin')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: { uid: 'tenant-user', cascadeTenantData: true } });

    expect(res.status).toBe(200);
    expect(res.body.result.recursosCascadaEliminados).toBe(7);
    expect(res.body.result.suscripcionesEliminadas).toBe(1);

    expect(backend.getData('usuarios', 'tenant-user')).toBeUndefined();
    expect(backend.getData('clientes', 'cli-1')).toBeUndefined();
    expect(backend.getData('cuentas', 'cta-1')).toBeUndefined();
    expect(backend.getData('ventas', 'ven-1')).toBeUndefined();
    expect(backend.getData('movimientos', 'mov-1')).toBeUndefined();
    expect(backend.getData('notificaciones', 'not-1')).toBeUndefined();
    expect(backend.getData('codigosVinculacion', 'cod-1')).toBeUndefined();
    expect(backend.getData('vinculaciones', 'vin-1')).toBeUndefined();
    expect(backend.getData('clientes', 'cli-otro')).toBeDefined();
  });
});

describe('sincronizarUsuariosAuth (admin)', () => {
  beforeEach(() => {
    backend.auth.setToken('tk-admin', { uid: 'admin-1', role: 'admin' });
    backend.auth.setToken('tk-user', { uid: 'user-normal', role: 'user' });
  });

  it('401 si no hay token de autenticación', async () => {
    const res = await request(app)
      .post('/api/sincronizarUsuariosAuth')
      .send({ data: { accion: 'auditar' } });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('403 si el usuario no es admin', async () => {
    const res = await request(app)
      .post('/api/sincronizarUsuariosAuth')
      .set('Authorization', 'Bearer tk-user')
      .send({ data: { accion: 'auditar' } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('modo auditar: detecta huérfanos de Firestore y huérfanos de Auth', async () => {
    // Auth users: auth-only-1, common-1
    backend.auth.addAuthUser({
      uid: 'auth-only-1',
      email: 'authonly@example.com',
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
      metadata: { creationTime: '2026-01-01T00:00:00Z' },
    } as any);
    backend.auth.addAuthUser({
      uid: 'common-1',
      email: 'common@example.com',
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
      metadata: { creationTime: '2026-01-01T00:00:00Z' },
    } as any);

    // Firestore users: firestore-only-1, common-1
    backend.seed('usuarios', 'firestore-only-1', {
      nombre: 'Huerfano Firestore',
      correo: 'huerfano@example.com',
    });
    backend.seed('usuarios', 'common-1', {
      nombre: 'Usuario Comun',
      correo: 'common@example.com',
    });

    const res = await request(app)
      .post('/api/sincronizarUsuariosAuth')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: { accion: 'auditar' } });

    expect(res.status).toBe(200);
    expect(res.body.result.totalAuth).toBe(2);
    expect(res.body.result.totalFirestore).toBe(2);
    expect(res.body.result.huerfanosFirestore).toEqual([
      expect.objectContaining({ uid: 'firestore-only-1', email: 'huerfano@example.com' }),
    ]);
    expect(res.body.result.huerfanosAuth).toEqual([
      expect.objectContaining({ uid: 'auth-only-1', email: 'authonly@example.com' }),
    ]);
    expect(res.body.result.purgados.usuariosFirestore).toBe(0);
    expect(backend.getData('usuarios', 'firestore-only-1')).toBeDefined();
  });

  it('modo purgar_huerfanos: elimina documentos huérfanos de Firestore y sus suscripciones', async () => {
    // Auth user: common-1
    backend.auth.addAuthUser({
      uid: 'common-1',
      email: 'common@example.com',
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
      metadata: { creationTime: '2026-01-01T00:00:00Z' },
    } as any);

    // Firestore users: huerfano-1, common-1
    backend.seed('usuarios', 'huerfano-1', {
      nombre: 'Huerfano 1',
      correo: 'huerfano1@example.com',
    });
    backend.seed('usuarios', 'common-1', {
      nombre: 'Comun',
      correo: 'common@example.com',
    });
    backend.seed('suscripciones', 'sub-huerfano', {
      usuarioId: 'huerfano-1',
      planNombre: 'Pro',
    });
    backend.seed('suscripciones', 'sub-comun', {
      usuarioId: 'common-1',
      planNombre: 'Starter',
    });

    const res = await request(app)
      .post('/api/sincronizarUsuariosAuth')
      .set('Authorization', 'Bearer tk-admin')
      .send({ data: { accion: 'purgar_huerfanos' } });

    expect(res.status).toBe(200);
    expect(res.body.result.purgados).toEqual({
      usuariosFirestore: 1,
      suscripciones: 1,
    });

    expect(backend.getData('usuarios', 'huerfano-1')).toBeUndefined();
    expect(backend.getData('suscripciones', 'sub-huerfano')).toBeUndefined();
    expect(backend.getData('usuarios', 'common-1')).toBeDefined();
    expect(backend.getData('suscripciones', 'sub-comun')).toBeDefined();
  });
});