import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePermisos, { detectarFamilia } from './usePermisos';

const mockUseSuscripciones = vi.fn();

vi.mock('./useSuscripciones', () => ({
  default: (...args: unknown[]) => mockUseSuscripciones(...args),
}));

describe('usePermisos — PLG Tier Logic and Quotas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectarFamilia', () => {
    it('returns Starter when empty or unknown', () => {
      expect(detectarFamilia('')).toBe('Starter');
      expect(detectarFamilia('Basico')).toBe('Starter');
    });

    it('detects Admin', () => {
      expect(detectarFamilia('admin')).toBe('Admin');
      expect(detectarFamilia('Admin')).toBe('Admin');
    });

    it('detects Professional / Pro', () => {
      expect(detectarFamilia('Professional')).toBe('Professional');
      expect(detectarFamilia('professional-mensual')).toBe('Professional');
      expect(detectarFamilia('Pro Anual')).toBe('Professional');
    });

    it('detects Enterprise', () => {
      expect(detectarFamilia('Enterprise')).toBe('Enterprise');
      expect(detectarFamilia('enterprise-trimestral')).toBe('Enterprise');
      expect(detectarFamilia('Plan Enterprise VIP')).toBe('Enterprise');
    });
  });

  describe('Self-registered user without subscription (Default Starter)', () => {
    it('returns full Starter permissions (20 clients, 5 accounts, dashboard unlocked)', () => {
      mockUseSuscripciones.mockReturnValue({
        suscripciones: [],
        loading: false,
        error: null,
      });

      const { result } = renderHook(() =>
        usePermisos({ uid: 'new-user-123', rol: 'usuario' })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.planNombre).toBe('Starter');
      expect(result.current.clienteLimit).toBe(20);
      expect(result.current.cuentaLimit).toBe(5);
      expect(result.current.puedeGestionarCuentas).toBe(true);
      expect(result.current.puedeVerDashboardEjecutivo).toBe(true);
      expect(result.current.puedeExportarExcel).toBe(true);
      expect(result.current.puedeUsarTelegram).toBe(false);
      expect(result.current.puedeVerReportesAvanzados).toBe(false);
      expect(result.current.puedeGenerarTokens).toBe(false);
    });
  });

  describe('Professional subscription', () => {
    it('returns Professional features with infinite clients and accounts, telegram and reports enabled', () => {
      mockUseSuscripciones.mockReturnValue({
        suscripciones: [
          {
            id: 'sub-pro',
            planNombre: 'Professional Mensual',
            estado: 'activa',
          },
        ],
        loading: false,
        error: null,
      });

      const { result } = renderHook(() =>
        usePermisos({ uid: 'pro-user-123', rol: 'usuario' })
      );

      expect(result.current.planNombre).toBe('Professional Mensual');
      expect(result.current.clienteLimit).toBe(Infinity);
      expect(result.current.cuentaLimit).toBe(Infinity);
      expect(result.current.puedeGestionarCuentas).toBe(true);
      expect(result.current.puedeVerDashboardEjecutivo).toBe(true);
      expect(result.current.puedeExportarExcel).toBe(true);
      expect(result.current.puedeUsarTelegram).toBe(true);
      expect(result.current.puedeVerReportesAvanzados).toBe(true);
      expect(result.current.tieneSoportePrioritario).toBe(true);
      expect(result.current.tieneSoporte247).toBe(false);
      expect(result.current.puedeGenerarTokens).toBe(false);
    });
  });

  describe('Enterprise subscription', () => {
    it('returns Enterprise features with everything unlocked including tokens and 24/7 support', () => {
      mockUseSuscripciones.mockReturnValue({
        suscripciones: [
          {
            id: 'sub-ent',
            planNombre: 'Enterprise Anual',
            estado: 'activa',
          },
        ],
        loading: false,
        error: null,
      });

      const { result } = renderHook(() =>
        usePermisos({ uid: 'ent-user-123', rol: 'usuario' })
      );

      expect(result.current.planNombre).toBe('Enterprise Anual');
      expect(result.current.clienteLimit).toBe(Infinity);
      expect(result.current.cuentaLimit).toBe(Infinity);
      expect(result.current.puedeGestionarCuentas).toBe(true);
      expect(result.current.puedeVerDashboardEjecutivo).toBe(true);
      expect(result.current.puedeExportarExcel).toBe(true);
      expect(result.current.puedeUsarTelegram).toBe(true);
      expect(result.current.puedeVerReportesAvanzados).toBe(true);
      expect(result.current.tieneSoportePrioritario).toBe(true);
      expect(result.current.tieneSoporte247).toBe(true);
      expect(result.current.puedeGenerarTokens).toBe(true);
    });
  });

  describe('Admin user', () => {
    it('returns unlimited access for admin regardless of subscriptions', () => {
      mockUseSuscripciones.mockReturnValue({
        suscripciones: [],
        loading: false,
        error: null,
      });

      const { result } = renderHook(() =>
        usePermisos({ uid: 'admin-123', rol: 'admin' })
      );

      expect(result.current.planNombre).toBe('Admin');
      expect(result.current.clienteLimit).toBe(Infinity);
      expect(result.current.cuentaLimit).toBe(Infinity);
      expect(result.current.puedeGestionarCuentas).toBe(true);
      expect(result.current.puedeVerDashboardEjecutivo).toBe(true);
      expect(result.current.puedeGenerarTokens).toBe(true);
    });
  });
});
