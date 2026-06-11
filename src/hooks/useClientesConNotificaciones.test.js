import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockUseClientes = vi.fn();
vi.mock('./useClientes', () => ({
  default: (...args) => mockUseClientes(...args),
}));

import useClientesConNotificaciones from './useClientesConNotificaciones';

function createMockCliente(overrides = {}) {
  return {
    id: `uid_${overrides.nombre || 'Test'}`,
    nombre: overrides.nombre || 'Test Client',
    telefono: '3001234567',
    correo: 'test@client.com',
    plataforma: overrides.plataforma || 'Netflix',
    propietarioId: 'test-uid',
    usuarioEmail: 'test@streamcontrol.com',
    fechaVencimiento: overrides.fechaVencimiento || '2026-06-15',
    diasRestantes: overrides.diasRestantes ?? 5,
    saldoPendiente: overrides.saldoPendiente ?? 0,
  };
}

describe('useClientesConNotificaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty notifications when loading', () => {
    mockUseClientes.mockReturnValue({ clientes: [], loading: true });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('returns empty notifications when no clientes', () => {
    mockUseClientes.mockReturnValue({ clientes: [], loading: false });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toEqual([]);
  });

  it('generates vencimiento notification for clientes with 1 day remaining', () => {
    mockUseClientes.mockReturnValue({
      clientes: [createMockCliente({ diasRestantes: 1 })],
      loading: false,
    });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toHaveLength(1);
    expect(result.current.notificaciones[0].tipo).toBe('vencimiento');
    expect(result.current.notificaciones[0].diasRestantes).toBe(1);
  });

  it('generates vencimiento notification for expired clientes (<= 0 days)', () => {
    mockUseClientes.mockReturnValue({
      clientes: [createMockCliente({ diasRestantes: 0 })],
      loading: false,
    });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toHaveLength(1);
    expect(result.current.notificaciones[0].tipo).toBe('vencimiento');
    expect(result.current.notificaciones[0].diasRestantes).toBe(0);
  });

  it('generates vencimiento notifications for 3 and 5 days remaining', () => {
    mockUseClientes.mockReturnValue({
      clientes: [
        createMockCliente({ nombre: 'A', diasRestantes: 3 }),
        createMockCliente({ nombre: 'B', diasRestantes: 5 }),
      ],
      loading: false,
    });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toHaveLength(2);
  });

  it('does NOT generate vencimiento notification for 2 or 4 days remaining', () => {
    mockUseClientes.mockReturnValue({
      clientes: [
        createMockCliente({ nombre: 'A', diasRestantes: 2 }),
        createMockCliente({ nombre: 'B', diasRestantes: 4 }),
        createMockCliente({ nombre: 'C', diasRestantes: 10 }),
      ],
      loading: false,
    });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toHaveLength(0);
  });

  it('generates mora notification for clientes with saldoPendiente > 0', () => {
    mockUseClientes.mockReturnValue({
      clientes: [createMockCliente({ saldoPendiente: 50000, diasRestantes: 10 })],
      loading: false,
    });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toHaveLength(1);
    expect(result.current.notificaciones[0].tipo).toBe('mora');
    expect(result.current.notificaciones[0].saldoPendiente).toBe(50000);
  });

  it('does NOT generate mora notification when saldoPendiente is 0', () => {
    mockUseClientes.mockReturnValue({
      clientes: [createMockCliente({ saldoPendiente: 0 })],
      loading: false,
    });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    const moras = result.current.notificaciones.filter(n => n.tipo === 'mora');
    expect(moras).toHaveLength(0);
  });

  it('sorts mora before vencimiento notifications', () => {
    const clienteVencido = createMockCliente({ nombre: 'Vencido', diasRestantes: 0, saldoPendiente: 0 });
    const clienteMora = createMockCliente({ nombre: 'Mora', diasRestantes: 10, saldoPendiente: 30000 });

    mockUseClientes.mockReturnValue({
      clientes: [clienteVencido, clienteMora],
      loading: false,
    });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toHaveLength(2);
    expect(result.current.notificaciones[0].tipo).toBe('mora');
    expect(result.current.notificaciones[1].tipo).toBe('vencimiento');
  });

  it('handles both mora AND vencimiento for the same cliente', () => {
    const cliente = createMockCliente({
      nombre: 'Dual',
      diasRestantes: 1,
      saldoPendiente: 25000,
    });

    mockUseClientes.mockReturnValue({
      clientes: [cliente],
      loading: false,
    });

    const { result } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    expect(result.current.notificaciones).toHaveLength(2);
    const tipos = result.current.notificaciones.map(n => n.tipo).sort();
    expect(tipos).toEqual(['mora', 'vencimiento']);
  });

  it('recalculates when clientes data changes', () => {
    const { result, rerender } = renderHook(() => useClientesConNotificaciones({ uid: 'test-uid' }));

    // Primera carga: sin datos
    mockUseClientes.mockReturnValue({ clientes: [], loading: false });
    rerender();
    expect(result.current.notificaciones).toHaveLength(0);

    // Segunda carga: cliente en mora (sin vencimiento cercano)
    mockUseClientes.mockReturnValue({
      clientes: [createMockCliente({ saldoPendiente: 50000, diasRestantes: 10 })],
      loading: false,
    });
    rerender();
    expect(result.current.notificaciones).toHaveLength(1);
    expect(result.current.notificaciones[0].tipo).toBe('mora');
  });
});
