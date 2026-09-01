/**
 * Tests de los 8 endpoints de codigos.ts con Firestore fake (AD-9).
 * imap mockeado; rate-limit transaccional AD-8 (tokens/{token}) testeado;
 * rate-limits de registry (uid/cuenta/token/email) → rateLimit.test.ts.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin } from './helpers/firebaseAdminMock.js';
import { createApp } from '../src/app.js';

const imapMocks = vi.hoisted(() => ({
  buscarCodigoVerificacion: vi.fn(async (): Promise<{ codigo: string; fecha: string; tipo: string } | null> => ({
    codigo: '123456',
    fecha: new Date().toISOString(),
    tipo: 'viajenet',
  })),
}));

vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());
vi.mock('../src/imap.js', () => imapMocks);

const app = createApp();
const TK = 'tk-codigos';
const FUTURO = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
const PASADO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

beforeEach(() => {
  backend.reset();
  backend.auth.setToken(TK, { uid: 'uid-1', email: 'ana@example.com' });
  imapMocks.buscarCodigoVerificacion.mockClear();
  imapMocks.buscarCodigoVerificacion.mockResolvedValue({
    codigo: '123456',
    fecha: new Date().toISOString(),
    tipo: 'viajenet',
  });
});

const seedSuscripcionEnterprise = () =>
  backend.seed('suscripciones', 's1', { usuarioId: 'uid-1', estado: 'activa', planNombre: 'Enterprise Pro' });

const seedCuenta = (id = 'c1', propietarioId = 'uid-1', perfiles?: unknown[]) =>
  backend.seed('cuentas', id, {
    propietarioId,
    proveedor: 'Netflix',
    correoCuenta: 'cuenta@example.com',
    perfiles: perfiles ?? [{ nombre: 'netflix1', estado: 'disponible' }],
  });

const seedTokenValido = (overrides: Record<string, unknown> = {}) =>
  backend.seed('tokens', 'tok-1', {
    token: 'tok-1',
    cuentaId: 'c1',
    perfilNombre: 'netflix1',
    clienteId: 'cl-1',
    clienteNombre: 'Ana',
    vendedorId: 'uid-1',
    expiraEn: FUTURO,
    activo: true,
    useCount: 0,
    ...overrides,
  });

describe('generarToken', () => {
  it('requiere plan Enterprise (sin suscripción / plan básico)', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    backend.seed('suscripciones', 's1', { usuarioId: 'uid-1', estado: 'activa', planNombre: 'Basico' });

    const res = await request(app)
      .post('/api/generarToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', perfilNombre: 'netflix1', clienteId: 'cl-1', clienteNombre: 'Ana' } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('éxito → crea token con defaults', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta();

    const res = await request(app)
      .post('/api/generarToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', perfilNombre: 'netflix1', clienteId: 'cl-1', clienteNombre: 'Ana' } });

    expect(res.status).toBe(200);
    const { token, url } = res.body.result as { token: string; url: string };
    expect(url).toBe(`/r/${token}`);
    const doc = backend.getData('tokens', token)!;
    expect(doc.activo).toBe(true);
    expect(doc.useCount).toBe(0);
    expect(doc.vendedorId).toBe('uid-1');
    expect(doc.cuentaId).toBe('c1');
  });

  it('cuenta inexistente → 404; cuenta ajena → 403; campos faltantes → 400', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta('c2', 'uid-otro');

    const noCuenta = await request(app)
      .post('/api/generarToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'zzz', perfilNombre: 'p', clienteId: 'c', clienteNombre: 'x' } });
    expect(noCuenta.status).toBe(404);

    const ajena = await request(app)
      .post('/api/generarToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c2', perfilNombre: 'p', clienteId: 'c', clienteNombre: 'x' } });
    expect(ajena.status).toBe(403);

    const sinCampos = await request(app)
      .post('/api/generarToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1' } });
    expect(sinCampos.status).toBe(400);
  });
});

describe('validarToken (auth none + rate-limit token 30/60s)', () => {
  it('token inexistente → valido:false sin error HTTP', async () => {
    const res = await request(app).post('/api/validarToken').send({ data: { token: 'no-existe' } });
    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ valido: false, error: 'Token no encontrado' });
  });

  it('token revocado → valido:false', async () => {
    seedTokenValido({ activo: false });
    const res = await request(app).post('/api/validarToken').send({ data: { token: 'tok-1' } });
    expect(res.body.result.error).toContain('revocado');
  });

  it('token expirado → valido:false', async () => {
    seedTokenValido({ expiraEn: PASADO });
    const res = await request(app).post('/api/validarToken').send({ data: { token: 'tok-1' } });
    expect(res.body.result.error).toContain('expirado');
  });

  it('válido → casos del proveedor sin resetnet', async () => {
    seedTokenValido();
    backend.seed('cuentas', 'c1', { proveedor: 'Netflix' });

    const res = await request(app).post('/api/validarToken').send({ data: { token: 'tok-1' } });

    expect(res.status).toBe(200);
    expect(res.body.result.valido).toBe(true);
    expect(res.body.result.proveedor).toBe('Netflix');
    expect(res.body.result.perfiles).toEqual(['netflix1']);
    expect(res.body.result.casos).toEqual(['viajenet', 'hogarnet', 'ininet']);
  });

  it('sin token → 400', async () => {
    const res = await request(app).post('/api/validarToken').send({ data: {} });
    expect(res.status).toBe(400);
  });
});

describe('consultarCodigo (auth none, rate-limit AD-8 transaccional)', () => {
  it('exitoso → encontrado y useCount incrementado', async () => {
    seedTokenValido();
    seedCuenta();
    backend.seed('cuentas_secretos', 'c1', { correo: 'imap@example.com', contrasena: 'x', imapHost: 'imap.gmail.com', imapPort: 993 });

    const res = await request(app)
      .post('/api/consultarCodigo')
      .send({ data: { token: 'tok-1', caso: 'viajenet' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ encontrado: true, codigo: '123456', tipo: 'viajenet' });
    expect(backend.getData('tokens', 'tok-1')?.useCount).toBe(1);
  });

  it('rate-limit AD-8: 5 intentos en ventana → 429 resource-exhausted', async () => {
    seedTokenValido({ rateLimit: { count: 5, windowStart: Date.now() } });
    const res = await request(app)
      .post('/api/consultarCodigo')
      .send({ data: { token: 'tok-1', caso: 'viajenet' } });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('resource-exhausted');
    expect(imapMocks.buscarCodigoVerificacion).not.toHaveBeenCalled();
  });

  it('AD-8 ventana vencida → resetea contador y deja pasar', async () => {
    seedTokenValido({ rateLimit: { count: 5, windowStart: Date.now() - 120_000 } });
    seedCuenta();
    backend.seed('cuentas_secretos', 'c1', { correo: 'imap@example.com', contrasena: 'x' });

    const res = await request(app)
      .post('/api/consultarCodigo')
      .send({ data: { token: 'tok-1', caso: 'viajenet' } });

    expect(res.status).toBe(200);
    expect(backend.getData('tokens', 'tok-1')?.rateLimit).toMatchObject({ count: 1 });
  });

  it('useCount >= 10 → 429 límite de consultas', async () => {
    seedTokenValido({ useCount: 10 });
    const res = await request(app)
      .post('/api/consultarCodigo')
      .send({ data: { token: 'tok-1', caso: 'viajenet' } });

    expect(res.status).toBe(429);
    expect(res.body.error.message).toContain('Límite de consultas');
  });

  it('token revocado/expirado/inexistente → 403/403/404', async () => {
    const inexistente = await request(app)
      .post('/api/consultarCodigo')
      .send({ data: { token: 'zzz', caso: 'viajenet' } });
    expect(inexistente.status).toBe(404);

    seedTokenValido({ activo: false });
    const revocado = await request(app)
      .post('/api/consultarCodigo')
      .send({ data: { token: 'tok-1', caso: 'viajenet' } });
    expect(revocado.status).toBe(403);

    seedTokenValido({ activo: true, expiraEn: PASADO });
    const expirado = await request(app)
      .post('/api/consultarCodigo')
      .send({ data: { token: 'tok-1', caso: 'viajenet' } });
    expect(expirado.status).toBe(403);
  });

  it('imap sin resultado → encontrado:false', async () => {
    seedTokenValido();
    seedCuenta();
    backend.seed('cuentas_secretos', 'c1', { correo: 'imap@example.com', contrasena: 'x' });
    imapMocks.buscarCodigoVerificacion.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/consultarCodigo')
      .send({ data: { token: 'tok-1', caso: 'viajenet' } });

    expect(res.body.result).toMatchObject({ encontrado: false });
  });

  it('mapping de errores IMAP: timeout→503, auth→403, otro→500', async () => {
    seedTokenValido();
    seedCuenta();
    backend.seed('cuentas_secretos', 'c1', { correo: 'imap@example.com', contrasena: 'x' });
    const post = () =>
      request(app).post('/api/consultarCodigo').send({ data: { token: 'tok-1', caso: 'viajenet' } });

    imapMocks.buscarCodigoVerificacion.mockRejectedValueOnce(new Error('Connection timeout'));
    expect((await post()).status).toBe(503);

    imapMocks.buscarCodigoVerificacion.mockRejectedValueOnce(new Error('authentication failed'));
    const authErr = await post();
    expect(authErr.status).toBe(403);
    expect(authErr.body.error.message).toContain('autenticación');

    imapMocks.buscarCodigoVerificacion.mockRejectedValueOnce(new Error('otra cosa'));
    expect((await post()).status).toBe(500);
  });

  it('faltan token o caso → 400', async () => {
    const res = await request(app).post('/api/consultarCodigo').send({ data: { token: 'tok-1' } });
    expect(res.status).toBe(400);
  });
});

describe('guardarCredenciales', () => {
  it('requiere plan Enterprise (sin suscripción / plan básico)', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    backend.seed('suscripciones', 's1', { usuarioId: 'uid-1', estado: 'activa', planNombre: 'Starter' });
    seedCuenta();

    const res = await request(app)
      .post('/api/guardarCredenciales')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', correo: 'imap@example.com', contrasena: 'pass' } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('éxito → guarda en cuentas_secretos con defaults IMAP', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta();

    const res = await request(app)
      .post('/api/guardarCredenciales')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', correo: 'imap@example.com', contrasena: 'pass' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true, cuentaId: 'c1' });
    const doc = backend.getData('cuentas_secretos', 'c1')!;
    expect(doc.correo).toBe('imap@example.com');
    expect(doc.imapHost).toBe('imap.gmail.com');
    expect(doc.imapPort).toBe(993);
    expect(doc.proveedorIMAP).toBe('gmail');
  });

  it('cuenta inexistente → 404; ajena → 403; faltan campos → 400', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta('c2', 'uid-otro');

    expect((await request(app)
      .post('/api/guardarCredenciales')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'zzz', correo: 'a@b.c', contrasena: 'x' } })).status).toBe(404);

    expect((await request(app)
      .post('/api/guardarCredenciales')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c2', correo: 'a@b.c', contrasena: 'x' } })).status).toBe(403);

    expect((await request(app)
      .post('/api/guardarCredenciales')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1' } })).status).toBe(400);
  });
});

describe('toggleToken', () => {
  it('éxito → desactiva token', async () => {
    seedTokenValido();

    const res = await request(app)
      .post('/api/toggleToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { tokenId: 'tok-1', activo: false } });

    expect(res.status).toBe(200);
    expect(res.body.result).toEqual({ success: true, activo: false });
    expect(backend.getData('tokens', 'tok-1')?.activo).toBe(false);
  });

  it('token ajeno → 403; inexistente → 404; tokenId faltante o activo no-booleano → 400', async () => {
    seedTokenValido({ vendedorId: 'uid-otro' });

    expect((await request(app)
      .post('/api/toggleToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { tokenId: 'tok-1', activo: false } })).status).toBe(403);

    expect((await request(app)
      .post('/api/toggleToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { tokenId: 'zzz', activo: false } })).status).toBe(404);

    expect((await request(app)
      .post('/api/toggleToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { tokenId: 'tok-1' } })).status).toBe(400);

    expect((await request(app)
      .post('/api/toggleToken')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { tokenId: 'tok-1', activo: 'si' } })).status).toBe(400);
  });
});

describe('consultarCodigoDirecto (bearer + rate-limit uid 10/cuenta 5 por 60s)', () => {
  it('requiere plan Enterprise', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    backend.seed('suscripciones', 's1', { usuarioId: 'uid-1', estado: 'activa', planNombre: 'Professional' });
    seedCuenta();

    const res = await request(app)
      .post('/api/consultarCodigoDirecto')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', caso: 'viajenet' } });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('permission-denied');
  });

  it('éxito → encontrado', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta();
    backend.seed('cuentas_secretos', 'c1', { correo: 'imap@example.com', contrasena: 'x' });

    const res = await request(app)
      .post('/api/consultarCodigoDirecto')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', caso: 'viajenet' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ encontrado: true, codigo: '123456' });
  });

  it('sin secretos IMAP → 404 "Credenciales IMAP no configuradas"', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta();
    const res = await request(app)
      .post('/api/consultarCodigoDirecto')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', caso: 'viajenet' } });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('Credenciales IMAP');
  });

  it('cuenta ajena → 403; inexistente → 404; faltan campos → 400', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta('c2', 'uid-otro');
    expect((await request(app)
      .post('/api/consultarCodigoDirecto')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c2', caso: 'viajenet' } })).status).toBe(403);

    expect((await request(app)
      .post('/api/consultarCodigoDirecto')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'zzz', caso: 'viajenet' } })).status).toBe(404);

    expect((await request(app)
      .post('/api/consultarCodigoDirecto')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1' } })).status).toBe(400);
  });

  it('rate-limit cuenta 5/60s → 6ta consulta 429', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta();
    backend.seed('cuentas_secretos', 'c1', { correo: 'imap@example.com', contrasena: 'x' });

    let last!: request.Response;
    for (let i = 0; i < 6; i++) {
      last = await request(app)
        .post('/api/consultarCodigoDirecto')
        .set('Authorization', `Bearer ${TK}`)
        .send({ data: { cuentaId: 'c1', caso: 'viajenet' } });
    }

    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('resource-exhausted');
    expect(imapMocks.buscarCodigoVerificacion).toHaveBeenCalledTimes(5);
  });
});

describe('generarTokenSubdistribuidor', () => {
  it('éxito → token + venta + movimiento + perfiles asignados', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta('c1', 'uid-1', [
      { nombre: 'netflix1', estado: 'disponible' },
      { nombre: 'netflix2', estado: 'disponible' },
    ]);

    const expiraEn = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const res = await request(app)
      .post('/api/generarTokenSubdistribuidor')
      .set('Authorization', `Bearer ${TK}`)
      .send({
        data: {
          cuentaId: 'c1',
          expiraEn,
          clienteNombre: 'Sub A',
          cantidad: 2,
          totalRecibido: 200,
          precioPorPerfil: 100,
          proveedor: 'Netflix',
          perfilesSeleccionados: [0, 1],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.result.url).toMatch(/^\/r\//);
    expect(backend.getCollection('ventas').length).toBe(1);
    expect(backend.getCollection('movimientos').length).toBe(1);
    const cuenta = backend.getData('cuentas', 'c1')!;
    expect((cuenta.perfiles as Array<{ estado: string }>)[0].estado).toBe('asignado');
    expect(cuenta.estado).toBe('asignada');
  });

  it('totalRecibido 0 → sin ventas ni movimientos', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedSuscripcionEnterprise();
    seedCuenta();

    const res = await request(app)
      .post('/api/generarTokenSubdistribuidor')
      .set('Authorization', `Bearer ${TK}`)
      .send({
        data: { cuentaId: 'c1', expiraEn: FUTURO, clienteNombre: 'Sub B', totalRecibido: 0 },
      });

    expect(res.status).toBe(200);
    expect(backend.getCollection('ventas').length).toBe(0);
    expect(backend.getCollection('movimientos').length).toBe(0);
  });

  it('sin Enterprise → 403; expiraEn pasado → 400; cuenta ajena → 403', async () => {
    backend.seed('usuarios', 'uid-1', { nombre: 'Ana' });
    seedCuenta('c2', 'uid-otro');

    const sinPlan = await request(app)
      .post('/api/generarTokenSubdistribuidor')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', expiraEn: FUTURO, totalRecibido: 0 } });
    expect(sinPlan.status).toBe(403);

    seedSuscripcionEnterprise();
    const pasado = await request(app)
      .post('/api/generarTokenSubdistribuidor')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1', expiraEn: PASADO, totalRecibido: 0 } });
    expect(pasado.status).toBe(400);

    const ajena = await request(app)
      .post('/api/generarTokenSubdistribuidor')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c2', expiraEn: FUTURO, totalRecibido: 0 } });
    expect(ajena.status).toBe(403);
  });
});

describe('obtenerCredencialesCuenta', () => {
  it('éxito → datos de cuenta + secretos', async () => {
    seedCuenta();
    backend.seed('cuentas_secretos', 'c1', { correo: 'imap@example.com', contrasena: 'pass' });

    const res = await request(app)
      .post('/api/obtenerCredencialesCuenta')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1' } });

    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({
      proveedor: 'Netflix',
      correoCuenta: 'cuenta@example.com',
      correo: 'imap@example.com',
      contrasena: 'pass',
    });
  });

  it('sin secretos → campos vacíos sin error', async () => {
    seedCuenta();
    const res = await request(app)
      .post('/api/obtenerCredencialesCuenta')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c1' } });

    expect(res.status).toBe(200);
    expect(res.body.result.correo).toBe('');
  });

  it('cuenta ajena → 403; inexistente → 404; sin cuentaId → 400', async () => {
    seedCuenta('c2', 'uid-otro');
    expect((await request(app)
      .post('/api/obtenerCredencialesCuenta')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'c2' } })).status).toBe(403);

    expect((await request(app)
      .post('/api/obtenerCredencialesCuenta')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: { cuentaId: 'zzz' } })).status).toBe(404);

    expect((await request(app)
      .post('/api/obtenerCredencialesCuenta')
      .set('Authorization', `Bearer ${TK}`)
      .send({ data: {} })).status).toBe(400);
  });
});