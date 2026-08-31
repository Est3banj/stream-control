import { describe, it, expect } from 'vitest';
import { calculateAdminMetrics } from './useAdminMetrics';
import type { Suscripcion } from '../types/suscripcion';
import type { Usuario } from '../types/usuario';
import type { Plan } from '../types/plan';
import { Timestamp } from 'firebase/firestore';

describe('calculateAdminMetrics engine', () => {
  const mockPlanes: Plan[] = [
    {
      id: 'plan-starter',
      nombre: 'Starter',
      descripcion: 'Plan mensual',
      precio: 30000,
      duracionDias: 30,
      features: [],
      activo: true,
      createdAt: { seconds: 1600000000, nanoseconds: 0 } as Timestamp,
    },
    {
      id: 'plan-anual',
      nombre: 'Pro Anual',
      descripcion: 'Plan anual',
      precio: 360000,
      duracionDias: 365,
      features: [],
      activo: true,
      createdAt: { seconds: 1600000000, nanoseconds: 0 } as Timestamp,
    },
  ];

  const mockUsuarios: Usuario[] = [
    {
      id: 'user-1',
      nombre: 'Admin One',
      correo: 'admin@streamcontrol.com',
      rol: 'admin',
      estado: 'activo',
      activoHasta: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      emailVerified: true,
    },
    {
      id: 'user-2',
      nombre: 'Tenant Alpha',
      correo: 'alpha@streamcontrol.com',
      rol: 'usuario',
      estado: 'activo',
      activoHasta: null,
      createdAt: '2026-02-01T00:00:00.000Z',
      emailVerified: true,
    },
    {
      id: 'user-3',
      nombre: 'Tenant Beta',
      correo: 'beta@streamcontrol.com',
      rol: 'usuario',
      estado: 'activo',
      activoHasta: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      emailVerified: false,
    },
  ];

  it('calculates normalized MRR, ARR, and ARPU correctly for monthly and annual plans', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const mockSuscripciones: Suscripcion[] = [
      {
        id: 'sub-1',
        usuarioId: 'user-2',
        usuarioNombre: 'Tenant Alpha',
        planId: 'plan-starter',
        planNombre: 'Starter',
        fechaInicio: { seconds: nowSeconds - 86400 * 10, nanoseconds: 0 } as Timestamp,
        fechaFin: { seconds: nowSeconds + 86400 * 20, nanoseconds: 0 } as Timestamp,
        estado: 'activa',
        pagoEstado: 'pagado',
        monto: 30000,
        createdAt: { seconds: nowSeconds - 86400 * 10, nanoseconds: 0 } as Timestamp,
        updatedAt: { seconds: nowSeconds - 86400 * 10, nanoseconds: 0 } as Timestamp,
      },
      {
        id: 'sub-2',
        usuarioId: 'user-3',
        usuarioNombre: 'Tenant Beta',
        planId: 'plan-anual',
        planNombre: 'Pro Anual',
        fechaInicio: { seconds: nowSeconds - 86400 * 10, nanoseconds: 0 } as Timestamp,
        fechaFin: { seconds: nowSeconds + 86400 * 350, nanoseconds: 0 } as Timestamp,
        estado: 'activa',
        pagoEstado: 'pagado',
        monto: 360000, // 360000 / 12 = 30000 MRR
        createdAt: { seconds: nowSeconds - 86400 * 10, nanoseconds: 0 } as Timestamp,
        updatedAt: { seconds: nowSeconds - 86400 * 10, nanoseconds: 0 } as Timestamp,
      },
    ];

    const result = calculateAdminMetrics(mockSuscripciones, mockUsuarios, mockPlanes);

    // Expected MRR: 30000 (monthly) + 30000 (annual normalized) = 60000
    expect(result.mrr).toBe(60000);
    expect(result.arr).toBe(60000 * 12); // 720000
    expect(result.activeTenantsCount).toBe(2);
    expect(result.arpu).toBe(30000);
    expect(result.totalTenants).toBe(2); // user-2 and user-3 (excluding admin user-1)
    expect(result.tasaConversion).toBe(100);
  });

  it('detects upcoming expirations in <= 3 days and <= 7 days cohorts', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const mockSuscripciones: Suscripcion[] = [
      {
        id: 'sub-exp-2d',
        usuarioId: 'user-2',
        usuarioNombre: 'Tenant Alpha',
        planId: 'plan-starter',
        planNombre: 'Starter',
        fechaInicio: { seconds: nowSeconds - 86400 * 28, nanoseconds: 0 } as Timestamp,
        fechaFin: { seconds: nowSeconds + 86400 * 2, nanoseconds: 0 } as Timestamp, // 2 days left
        estado: 'activa',
        pagoEstado: 'pendiente',
        monto: 30000,
        createdAt: { seconds: nowSeconds, nanoseconds: 0 } as Timestamp,
        updatedAt: { seconds: nowSeconds, nanoseconds: 0 } as Timestamp,
      },
      {
        id: 'sub-exp-5d',
        usuarioId: 'user-3',
        usuarioNombre: 'Tenant Beta',
        planId: 'plan-starter',
        planNombre: 'Starter',
        fechaInicio: { seconds: nowSeconds - 86400 * 25, nanoseconds: 0 } as Timestamp,
        fechaFin: { seconds: nowSeconds + 86400 * 5, nanoseconds: 0 } as Timestamp, // 5 days left
        estado: 'activa',
        pagoEstado: 'pagado',
        monto: 30000,
        createdAt: { seconds: nowSeconds, nanoseconds: 0 } as Timestamp,
        updatedAt: { seconds: nowSeconds, nanoseconds: 0 } as Timestamp,
      },
    ];

    const result = calculateAdminMetrics(mockSuscripciones, mockUsuarios, mockPlanes);

    expect(result.proximosVencer3Dias.length).toBe(1);
    expect(result.proximosVencer3Dias[0].id).toBe('sub-exp-2d');

    expect(result.proximosVencer7Dias.length).toBe(2);
    expect(result.carteraPendiente).toBe(30000);
    expect(result.totalPendientesCount).toBe(1);
  });

  it('handles verified vs pending email counts and plan distribution with legacy fallback', () => {
    const legacyUsuarios: Usuario[] = [
      {
        id: 'user-leg-1',
        nombre: 'Legacy User',
        correo: 'legacy@stream.com',
        rol: 'usuario',
        estado: 'activo',
        plan: 'Starter',
        activoHasta: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        emailVerified: true,
      },
    ];

    const result = calculateAdminMetrics([], legacyUsuarios, mockPlanes);

    expect(result.totalUsuarios).toBe(1);
    expect(result.usuariosVerificados).toBe(1);
    expect(result.usuariosPendientes).toBe(0);
    expect(result.mrr).toBe(30000);
    expect(result.activeTenantsCount).toBe(1);
    expect(result.distribucionPlanes).toEqual([{ name: 'Starter', value: 1 }]);
  });

  it('fallback detects upcoming expirations and mora from legacy usuario.activoHasta', () => {
    const now = Date.now();
    const twoDaysMs = now + 2 * 24 * 60 * 60 * 1000;
    const overdueMs = now - 3 * 24 * 60 * 60 * 1000;

    const legacyUsers: Usuario[] = [
      {
        id: 'u-expiring',
        nombre: 'Expiring Tenant',
        correo: 'exp@tenant.com',
        rol: 'usuario',
        estado: 'activo',
        plan: 'Starter',
        activoHasta: new Date(twoDaysMs) as any, // Date object format
        createdAt: '2026-01-01',
      },
      {
        id: 'u-overdue',
        nombre: 'Overdue Tenant',
        correo: 'overdue@tenant.com',
        rol: 'usuario',
        estado: 'activo',
        plan: 'Starter',
        activoHasta: new Date(overdueMs).toISOString() as any, // ISO string format
        createdAt: '2026-01-01',
      },
    ];

    const result = calculateAdminMetrics([], legacyUsers, mockPlanes);

    expect(result.proximosVencer3Dias.length).toBe(1);
    expect(result.proximosVencer3Dias[0].usuarioId).toBe('u-expiring');
    expect(result.vencidasSinRenovar.length).toBe(1);
    expect(result.vencidasSinRenovar[0].usuarioId).toBe('u-overdue');
    expect(result.todasExpiraciones.length).toBe(2);
  });

  it('excludes super admin accounts from tenant count and MRR calculations', () => {
    const mixedUsers: Usuario[] = [
      {
        id: 'admin-super',
        nombre: 'Super Admin',
        correo: 'super@admin.com',
        rol: 'admin',
        estado: 'activo',
        plan: 'Pro Anual',
        activoHasta: null,
        createdAt: '2026-01-01',
      },
      {
        id: 'tenant-real',
        nombre: 'Real Tenant',
        correo: 'tenant@test.com',
        rol: 'usuario',
        estado: 'activo',
        plan: 'Starter',
        activoHasta: null,
        createdAt: '2026-01-01',
      },
    ];

    const result = calculateAdminMetrics([], mixedUsers, mockPlanes);

    expect(result.totalUsuarios).toBe(2);
    expect(result.totalTenants).toBe(1); // Only tenant-real
    expect(result.mrr).toBe(30000); // Only tenant-real Starter plan
    expect(result.activeTenantsCount).toBe(1);
  });

  it('gracefully handles diverse date formats (Timestamp, _seconds, epoch number, ISO string, Date)', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const mockSuscripciones: Suscripcion[] = [
      {
        id: 'sub-iso',
        usuarioId: 'user-2',
        usuarioNombre: 'Tenant Alpha',
        planId: 'plan-starter',
        planNombre: 'Starter',
        fechaInicio: '2026-01-01T00:00:00Z' as any,
        fechaFin: new Date(Date.now() + 86400 * 1000 * 2) as any,
        estado: 'activa',
        pagoEstado: 'pagado',
        monto: 30000,
        createdAt: nowSeconds as any,
        updatedAt: nowSeconds as any,
      },
      {
        id: 'sub-raw-seconds',
        usuarioId: 'user-3',
        usuarioNombre: 'Tenant Beta',
        planId: 'plan-starter',
        planNombre: 'Starter',
        fechaInicio: { _seconds: nowSeconds - 86400 * 10, _nanoseconds: 0 } as any,
        fechaFin: { _seconds: nowSeconds + 86400 * 1, _nanoseconds: 0 } as any,
        estado: 'activa',
        pagoEstado: 'pagado',
        monto: 30000,
        createdAt: (nowSeconds * 1000) as any,
        updatedAt: (nowSeconds * 1000) as any,
      },
    ];

    const result = calculateAdminMetrics(mockSuscripciones, mockUsuarios, mockPlanes);

    expect(result.mrr).toBe(60000);
    expect(result.proximosVencer3Dias.length).toBe(2);
  });
});
