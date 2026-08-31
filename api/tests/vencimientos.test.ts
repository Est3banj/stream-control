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
import { limpiarPerfilesVencidos } from '../src/desasignar.js';

const DAY = 24 * 60 * 60 * 1000;

function iso(d: Date): string {
  return d.toISOString().split('T')[0];
}

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);
const HOY = iso(hoy);
const AYER = iso(new Date(hoy.getTime() - 1 * DAY));
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

  it('auto-cleanup: libera perfiles de clientes vencidos ayer (1 día / fechaVencimiento < HOY)', async () => {
    backend.seed('clientes', 'cl-ayer', {
      nombre: 'Ayer',
      fechaVencimiento: AYER,
      propietarioId: 'uid-5',
      cuentaId: 'cu-9',
      perfilAsignado: 'p1',
    });
    backend.seed('clientes', 'cl-hoy', {
      nombre: 'Hoy',
      fechaVencimiento: HOY,
      propietarioId: 'uid-5',
      cuentaId: 'cu-9',
      perfilAsignado: 'p2',
    });
    backend.seed('cuentas', 'cu-9', {
      propietarioId: 'uid-5',
      proveedor: 'Netflix',
      estado: 'asignada',
      perfiles: [
        { nombre: 'p1', estado: 'asignado', clienteNombre: 'Ayer' },
        { nombre: 'p2', estado: 'asignado', clienteNombre: 'Hoy' },
      ],
    });

    const res = await generarNotificacionesVencimientos();

    expect(res.perfilesLiberados).toBe(1);
    const perfiles = backend.getData('cuentas', 'cu-9')!.perfiles as Array<Record<string, unknown>>;
    expect(perfiles[0].estado).toBe('disponible');
    expect(perfiles[1].estado).toBe('asignado');
    expect(backend.getData('clientes', 'cl-ayer')!.cuentaId).toBeUndefined();
    expect(backend.getData('clientes', 'cl-hoy')!.cuentaId).toBe('cu-9');
  });

  it('limpiarPerfilesVencidos: diasGracia = 0 desasigna con fechaVencimiento < hoyStr', async () => {
    backend.seed('clientes', 'cl-vencido-1', {
      nombre: 'Vencido1',
      fechaVencimiento: AYER,
      propietarioId: 'uid-6',
      cuentaId: 'cu-10',
      perfilAsignado: 'perfil-1',
    });
    backend.seed('cuentas', 'cu-10', {
      propietarioId: 'uid-6',
      proveedor: 'Disney',
      estado: 'asignada',
      perfiles: [{ nombre: 'perfil-1', estado: 'asignado', clienteNombre: 'Vencido1' }],
    });

    const liberados = await limpiarPerfilesVencidos(0);
    expect(liberados).toBe(1);

    const cuenta = backend.getData('cuentas', 'cu-10')!;
    const perfiles = cuenta.perfiles as Array<Record<string, unknown>>;
    expect(perfiles[0].estado).toBe('disponible');
    expect(cuenta.estado).toBe('disponible');
    expect(backend.getData('clientes', 'cl-vencido-1')!.cuentaId).toBeUndefined();
  });

  it('limpiarPerfilesVencidos: maneja más de 500 registros con reinstanciación de batch', async () => {
    // 505 clientes vencidos sin cuenta (1 write cada uno)
    for (let i = 0; i < 505; i++) {
      backend.seed('clientes', `cl-mass-${i}`, {
        nombre: `Cliente ${i}`,
        fechaVencimiento: AYER,
        cuentaId: 'cu-inexistente',
        perfilAsignado: 'p1',
      });
    }

    const liberados = await limpiarPerfilesVencidos(0);
    expect(liberados).toBe(505);
    expect(backend.getData('clientes', 'cl-mass-0')!.cuentaId).toBeUndefined();
    expect(backend.getData('clientes', 'cl-mass-504')!.cuentaId).toBeUndefined();
  });
});