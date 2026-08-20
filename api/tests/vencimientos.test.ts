/**
 * Cron de vencimientos (AD-2): port del onSchedule original → verifica que
 * crea notifs únicas por día (idempotente), auto-expiraciones, mora y
 * auto-cleanup de perfiles vencidos (+3 días).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backend, mockFirebaseModule } from './helpers/setupFirebase.js';
import { mockFirebaseAdmin, TimestampFake } from './helpers/firebaseAdminMock.js';

vi.mock('../src/firebase', () => mockFirebaseModule());
vi.mock('firebase-admin', () => mockFirebaseAdmin());

import { generarNotificacionesVencimientos } from '../src/crons/vencimientos.js';

const DAY = 24 * 60 * 60 * 1000;

function iso(d: Date): string {
  return d.toISOString().split('T')[0];
}

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);
const HOY = iso(hoy);
const MANANA = iso(new Date(hoy.getTime() + DAY));
const EN_3 = iso(new Date(hoy.getTime() + 3 * DAY));
const VENCIDO = iso(new Date(hoy.getTime() - 5 * DAY));

beforeEach(() => {
  backend.reset();
  delete process.env.TELEGRAM_TOKEN;
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => 'ok', json: async () => ({ ok: true }) })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generarNotificacionesVencimientos', () => {
  it('seeding base: notif de vencimiento única por día (idempotente)', async () => {
    backend.seed('clientes', 'cl-1', {
      nombre: 'Ana',
      plataforma: 'Netflix',
      fechaVencimiento: MANANA,
      propietarioId: 'uid-1',
      usuarioEmail: 'ana@example.com',
      telefono: '3000000000',
    });
    // La notif de hoy ya existe → no debe duplicarse
    backend.seed('notificaciones', `uid-1_cl-1_${HOY}`, { clienteId: 'cl-1' });
    backend.seed('notificaciones', `mora_cl-2_${HOY}`, { clienteId: 'cl-2' });

    const res = await generarNotificacionesVencimientos();

    // La de cl-1 NO se crea (existe), mora de cl-2 NO se crea (existe) → 0 creadas
    expect(res.notificacionesCreadas).toBe(0);
    expect(backend.getData('notificaciones', `uid-1_cl-1_${HOY}`)).toBeDefined();
  });

  it('crea notifs de vencimiento, mora, suscripción y cuenta; auto-expira suscripción vencida', async () => {
    backend.seed('clientes', 'cl-nuevo', {
      nombre: 'Bruno',
      plataforma: 'Win',
      fechaVencimiento: EN_3,
      propietarioId: 'uid-2',
      usuarioEmail: 'bruno@example.com',
    });
    backend.seed('clientes', 'cl-mora', {
      nombre: 'Mora',
      saldoPendiente: 25000,
      propietarioId: 'uid-3',
    });
    backend.seed('suscripciones', 's-act', {
      estado: 'activa',
      usuarioNombre: 'Esteban',
      planNombre: 'Enterprise',
      fechaFin: new TimestampFake(hoy.getTime() + 2 * DAY),
    });
    backend.seed('suscripciones', 's-exp', {
      estado: 'activa',
      usuarioNombre: 'Perdido',
      planNombre: 'Basico',
      fechaFin: new TimestampFake(hoy.getTime() - 1 * DAY),
    });
    backend.seed('cuentas', 'cu-1', {
      proveedor: 'Max',
      correoCuenta: 'max@example.com',
      fechaVencimiento: EN_3,
      propietarioId: 'uid-4',
    });
    // Vinculaciones Telegram de los propietarios (vencimiento/mora/cuenta)
    backend.seed('vinculaciones', 'v-2', { uid: 'uid-2', telegramChatId: 4242 });
    backend.seed('vinculaciones', 'v-3', { uid: 'uid-3', telegramChatId: 4343 });
    backend.seed('vinculaciones', 'v-4', { uid: 'uid-4', telegramChatId: 4444 });
    // Admin con Telegram vinculado (suscripción)
    backend.seed('usuarios', 'u-admin', { rol: 'admin' });
    backend.seed('vinculaciones', 'v-admin', { uid: 'u-admin', telegramChatId: 9999 });

    process.env.TELEGRAM_TOKEN = '123:tok';
    const res = await generarNotificacionesVencimientos();

    expect(res.notificacionesCreadas).toBe(3); // cliente + suscripción + cuenta
    expect(res.telegramEnviados).toBe(3);
    expect(res.morasNotificadas).toBe(1);
    expect(res.autoExpiradas).toBe(1);
    expect(backend.getData('notificaciones', `uid-2_cl-nuevo_${HOY}`)).toBeDefined();
    expect(backend.getData('notificaciones', `mora_cl-mora_${HOY}`)).toBeDefined();
    expect(backend.getData('notificaciones', `sub_s-act_${HOY}`)).toBeDefined();
    expect(backend.getData('notificaciones', `cuenta_cu-1_${HOY}`)).toBeDefined();
    expect(backend.getData('suscripciones', 's-exp')?.estado).toBe('expirada');
  });

  it('cuentas expiradas o sin fechaVencimiento quedan fuera', async () => {
    backend.seed('cuentas', 'cu-exp', {
      proveedor: 'Netflix',
      fechaVencimiento: EN_3,
      estado: 'expirada',
      propietarioId: 'uid-4',
    });
    backend.seed('cuentas', 'cu-sin', { proveedor: 'Netflix', propietarioId: 'uid-4' });

    const res = await generarNotificacionesVencimientos();

    expect(res.notificacionesCreadas).toBe(0);
    expect(backend.getData('notificaciones', `cuenta_cu-exp_${HOY}`)).toBeUndefined();
    expect(backend.getData('notificaciones', `cuenta_cu-sin_${HOY}`)).toBeUndefined();
  });

  it('auto-cleanup: libera perfiles de clientes vencidos hace más de 3 días', async () => {
    backend.seed('clientes', 'cl-viejo', {
      nombre: 'Viejo',
      fechaVencimiento: VENCIDO,
      propietarioId: 'uid-5',
      cuentaId: 'cu-9',
      perfilAsignado: 'p1',
    });
    backend.seed('cuentas', 'cu-9', {
      propietarioId: 'uid-5',
      proveedor: 'Netflix',
      estado: 'asignada',
      perfiles: [{ nombre: 'p1', estado: 'asignado', clienteNombre: 'Viejo' }],
    });

    const res = await generarNotificacionesVencimientos();

    expect(res.perfilesLiberados).toBe(1);
    const perfil = (backend.getData('cuentas', 'cu-9')!.perfiles as Array<Record<string, unknown>>)[0];
    expect(perfil.estado).toBe('disponible');
    expect(backend.getData('clientes', 'cl-viejo')!.cuentaId).toBeUndefined();
  });
});