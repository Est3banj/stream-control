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

  it('handles verified vs pending email counts and plan distribution', () => {
    const result = calculateAdminMetrics([], mockUsuarios, mockPlanes);

    expect(result.totalUsuarios).toBe(3);
    expect(result.usuariosVerificados).toBe(2); // user-1 and user-2
    expect(result.usuariosPendientes).toBe(1); // user-3
    expect(result.porcentajeVerificados).toBeCloseTo(66.66, 1);
  });
});
