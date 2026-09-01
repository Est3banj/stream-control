import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import TicketModal from './TicketModal';

// Mocks
vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-test-123', email: 'vendedor@streamcontrol.com' },
  }),
}));

let mockCuentasDocs: any[] = [];
let mockVentasDocs: any[] = [];
let mockTokensDocs: any[] = [];

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ _type: name })),
  query: vi.fn((col) => col),
  where: vi.fn(),
  getDocs: vi.fn(async (q: any) => {
    if (q?._type === 'cuentas') return { docs: mockCuentasDocs };
    if (q?._type === 'ventas') return { docs: mockVentasDocs };
    if (q?._type === 'tokens') return { docs: mockTokensDocs };
    return { docs: [] };
  }),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getFirestore: vi.fn(),
}));

describe('TicketModal — Customer Delivery Ticket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCuentasDocs = [];
    mockVentasDocs = [];
    mockTokensDocs = [];
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders single sale with complete credentials, profile and PIN, excluding price and cost', async () => {
    mockVentasDocs = [
      {
        id: 'venta-1',
        data: () => ({
          nombre: 'Carlos Gómez',
          plataforma: 'Netflix 4K',
          correo: 'netflix_premium@cuenta.com',
          contrasena: 'claveSuperSecreta',
          perfilNombre: 'Carlos',
          perfilPin: '4321',
          precioVenta: 15000,
          costoServicio: 8000,
          utilidad: 7000,
          fechaVencimiento: '2026-12-31',
          diasServicio: 30,
          notas: 'No cambiar correo ni contraseña',
        }),
      },
    ];

    const onClose = vi.fn();
    render(
      <TicketModal
        cliente={{ nombre: 'Carlos Gómez', telefono: '+573001112233' }}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Ticket de Entrega: Carlos Gómez/i)).toBeTruthy();
    });

    // Verify customer credentials are shown
    expect(screen.getByText('Netflix 4K')).toBeTruthy();
    expect(screen.getByText('netflix_premium@cuenta.com')).toBeTruthy();
    expect(screen.getByText('claveSuperSecreta')).toBeTruthy();
    expect(screen.getByText('Carlos')).toBeTruthy();
    expect(screen.getByText('PIN: 4321')).toBeTruthy();
    expect(screen.getByText(/Vence: 2026-12-31/i)).toBeTruthy();
    expect(screen.getByText('No cambiar correo ni contraseña')).toBeTruthy();

    // Verify NEVER showing price or cost
    expect(screen.queryByText(/15000/)).toBeNull();
    expect(screen.queryByText(/8000/)).toBeNull();
    expect(screen.queryByText(/7000/)).toBeNull();
    expect(screen.queryByText(/precio/i)).toBeNull();
    expect(screen.queryByText(/costo/i)).toBeNull();

    // Test WhatsApp copy function
    const copyBtn = screen.getByRole('button', { name: /copiar ticket/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const copiedText = (navigator.clipboard.writeText as any).mock.calls[0][0];

    expect(copiedText).toContain('Carlos Gómez');
    expect(copiedText).toContain('+573001112233');
    expect(copiedText).toContain('Netflix 4K');
    expect(copiedText).toContain('netflix_premium@cuenta.com');
    expect(copiedText).toContain('claveSuperSecreta');
    expect(copiedText).toContain('Perfil: Carlos');
    expect(copiedText).toContain('PIN: 4321');
    expect(copiedText).toContain('2026-12-31');
    expect(copiedText).toContain('No cambiar correo ni contraseña');

    // Make sure no pricing is inside the copied text
    expect(copiedText).not.toContain('15000');
    expect(copiedText).not.toContain('8000');
  });

  it('renders combo / multi-service sale with multi-profile array and respective PINs', async () => {
    mockVentasDocs = [
      {
        id: 'venta-combo-1',
        data: () => ({
          nombre: 'Lucia Rios',
          plataforma: 'Combo Max + Disney',
          precioVenta: 28000,
          costoServicio: 14000,
          servicios: [
            {
              plataforma: 'Max Standard',
              correo: 'max_familia@cuenta.com',
              contrasena: 'maxPass789',
              perfiles: [
                { nombre: 'Lucia', pin: '1111' },
                { nombre: 'Niños', pin: '2222' },
              ],
              fechaVencimiento: '2026-11-20',
            },
            {
              plataforma: 'Disney+ Premium',
              correo: 'disney_plus@cuenta.com',
              contrasena: 'disneyPass456',
              perfilNombre: 'Lucia Disney',
              perfilPin: '9999',
              fechaVencimiento: '2026-11-25',
            },
          ],
        }),
      },
    ];

    mockTokensDocs = [
      {
        id: 'tok-1',
        data: () => ({ token: 'abc-xyz-token', activo: true }),
      },
    ];

    render(
      <TicketModal
        cliente={{ nombre: 'Lucia Rios', telefono: '+573119998877' }}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Max Standard')).toBeTruthy();
      expect(screen.getByText('Disney+ Premium')).toBeTruthy();
    });

    // Check Max profiles
    expect(screen.getByText('Lucia')).toBeTruthy();
    expect(screen.getByText('PIN: 1111')).toBeTruthy();
    expect(screen.getByText('Niños')).toBeTruthy();
    expect(screen.getByText('PIN: 2222')).toBeTruthy();

    // Check Disney profiles
    expect(screen.getByText('Lucia Disney')).toBeTruthy();
    expect(screen.getByText('PIN: 9999')).toBeTruthy();

    // Check Token link
    expect(screen.getByText(/Portal de consulta de códigos/i)).toBeTruthy();
    expect(screen.getByText(/abc-xyz-token/)).toBeTruthy();

    // Copy to clipboard
    const copyBtn = screen.getByRole('button', { name: /copiar ticket/i });
    fireEvent.click(copyBtn);

    const copiedText = (navigator.clipboard.writeText as any).mock.calls[0][0];
    expect(copiedText).toContain('Max Standard');
    expect(copiedText).toContain('Lucia (PIN: 1111)');
    expect(copiedText).toContain('Niños (PIN: 2222)');
    expect(copiedText).toContain('Disney+ Premium');
    expect(copiedText).toContain('Perfil: Lucia Disney');
    expect(copiedText).toContain('PIN: 9999');
    expect(copiedText).toContain('/r/abc-xyz-token');
  });

  it('resolves email, profile and PIN from linked account (cuentaId) when omitted on sale', async () => {
    mockCuentasDocs = [
      {
        id: 'cuenta-netflix-99',
        data: () => ({
          proveedor: 'Netflix',
          correoCuenta: 'netflix_cuenta_master@stream.com',
          perfiles: [
            { nombre: 'Perfil 1', pin: '7777', estado: 'asignado', clienteNombre: 'Pedro Gomez' },
            { nombre: 'Perfil 2', pin: '8888', estado: 'disponible' },
          ],
        }),
      },
    ];

    mockVentasDocs = [
      {
        id: 'venta-ref-1',
        data: () => ({
          nombre: 'Pedro Gomez',
          plataforma: 'Netflix',
          cuentaId: 'cuenta-netflix-99',
          perfilNombre: 'Perfil 1',
          fechaVencimiento: '2026-10-15',
        }),
      },
    ];

    render(
      <TicketModal
        cliente={{ nombre: 'Pedro Gomez' }}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Netflix')).toBeTruthy();
    });

    // Resolved from linked account
    expect(screen.getByText('netflix_cuenta_master@stream.com')).toBeTruthy();
    expect(screen.getByText('Perfil 1')).toBeTruthy();
    expect(screen.getByText('PIN: 7777')).toBeTruthy();
  });
});
