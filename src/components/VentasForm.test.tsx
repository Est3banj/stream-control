import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════

const mockAddDoc = vi.fn((...args: any[]) => Promise.resolve({ id: 'new-venta-id' }));
const mockSetDoc = vi.fn((...args: any[]) => Promise.resolve());
const mockUpdateDoc = vi.fn((...args: any[]) => Promise.resolve());
const mockGetDoc = vi.fn((...args: any[]) => undefined as any);
const mockCollection = vi.fn((...args: any[]) => ({ _path: args[1] as string }));
const mockDoc = vi.fn((...args: any[]) => ({
  _path: args[1] as string,
  _id: args[1] === 'clientes' ? (args.slice(2) as string[]).join('_') : args[2] as string,
}));

const mockGetDocs = vi.fn((...args: any[]) => Promise.resolve({ empty: true, docs: [] as any[], size: 0 }));

vi.mock('../firebase', () => ({
  db: { _mock: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => ({ _query: true, args }),
  where: (...args: any[]) => ({ _where: true, args }),
  serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
  increment: (n: number) => ({ _methodName: 'increment', _value: n }),
  onSnapshot: () => () => {}, // noop unsubscribe
  writeBatch: () => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) }),
}));

const mockUser = { uid: 'test-uid-123', email: 'test@streamcontrol.com' };
const mockPermisos = {
  planNombre: 'Starter',
  loading: false,
  clienteLimit: Infinity,
  cuentaLimit: 5,
  puedeUsarTelegram: false,
  puedeVerReportesAvanzados: false,
  puedeExportarExcel: true,
  puedeVerDashboardEjecutivo: true,
  tieneSoportePrioritario: false,
  tieneSoporte247: false,
  puedeGestionarCuentas: true,
  puedeGenerarTokens: false,
};

const mockUsePermisos = vi.fn(() => mockPermisos);

vi.mock('../hooks/usePermisos', () => ({
  default: () => mockUsePermisos(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../hooks/useMoneda', () => ({
  useMoneda: () => ({
    moneda: 'COP',
    simbolo: '$',
    formatear: (v: number) => `$${v.toLocaleString('es-CO')}`,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// ═══════════════════════════════════════════════════════════════
// IMPORTS (después de mocks para que se resuelvan correctamente)
// ═══════════════════════════════════════════════════════════════

import toast from 'react-hot-toast';
import VentasForm from './VentasForm';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Busca un input por su atributo name dentro del container */
function getInput(container: HTMLElement, name: string): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!el) throw new Error(`Input with name "${name}" not found`);
  return el;
}

function createDocSnapshot(id: string, data: Record<string, unknown> | null, exists = true) {
  return {
    id,
    exists: () => exists,
    data: () => (exists ? data : undefined),
  };
}

/** Completa los campos obligatorios del formulario excepto saldoPendiente */
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>, container: HTMLElement): Promise<void> {
  await user.type(screen.getByPlaceholderText('Ej: Juan Pérez'), 'Cliente Test');
  await user.type(screen.getByPlaceholderText('Ej: +573104567890 o @usuario'), '+573001234567');
  await user.type(
    screen.getByPlaceholderText('Ej: Netflix, Disney+, Spotify...'),
    'Netflix',
  );
  fireEvent.change(getInput(container, 'pantallas'), { target: { value: '2' } });
  fireEvent.change(getInput(container, 'fechaInicio'), { target: { value: '2026-07-01' } });
  fireEvent.change(getInput(container, 'diasServicio'), { target: { value: '30' } });
  fireEvent.change(getInput(container, 'precioVenta'), { target: { value: '15000' } });
  fireEvent.change(getInput(container, 'costoServicio'), { target: { value: '5000' } });
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('VentasForm — Renderizado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza todos los campos del formulario', () => {
    const { container } = render(<VentasForm />);

    // Inputs con placeholder
    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: +573104567890 o @usuario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('email de la cuenta (Netflix...)')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Ej: Netflix, Disney+, Spotify...'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: 30')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Principal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('1234')).toBeInTheDocument();

    // Inputs sin placeholder
    expect(getInput(container, 'pantallas')).toBeInTheDocument();
    expect(getInput(container, 'fechaInicio')).toBeInTheDocument();
    expect(getInput(container, 'precioVenta')).toBeInTheDocument();
    expect(getInput(container, 'costoServicio')).toBeInTheDocument();

    // Checkbox de pagado + botón submit
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /registrar venta/i }),
    ).toBeInTheDocument();
  });

  it('oculta el campo saldoPendiente cuando pagado=true (default)', () => {
    render(<VentasForm />);

    expect(screen.queryByPlaceholderText(/0\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/saldo pendiente/i)).not.toBeInTheDocument();
  });

  it('muestra y oculta saldoPendiente al togglear el checkbox pagado', async () => {
    const user = userEvent.setup();
    render(<VentasForm />);

    const checkbox = screen.getByRole('checkbox', { name: /pagó completo/i });
    expect(checkbox).toBeChecked();

    // Desmarcar → aparece campo saldoPendiente
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByPlaceholderText(/0\.00/)).toBeInTheDocument();

    // Volver a marcar → desaparece
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.queryByPlaceholderText(/0\.00/)).not.toBeInTheDocument();
  });
});

describe('VentasForm — Validaciones', () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDoc.mockResolvedValue(createDocSnapshot('no-existe', null, false));
    const renderResult = render(<VentasForm />);
    container = renderResult.container;
  });

  function submitForm(): void {
    const form = container.querySelector('form');
    if (form) fireEvent.submit(form);
  }

  it('muestra error si el nombre está vacío al hacer submit', () => {
    submitForm();

    expect(toast.error).toHaveBeenCalledWith(
      'El nombre del cliente es obligatorio.',
    );
  });

  it('muestra error si el teléfono contiene caracteres no numéricos', async () => {
    const user = userEvent.setup();

    // Completar todos los campos obligatorios con teléfono inválido
    await fillRequiredFields(user, container);
    // Sobreescribir teléfono con caracteres no numéricos (sin + ni @)
    const telInput = screen.getByPlaceholderText('Ej: +573104567890 o @usuario');
    await user.clear(telInput);
    await user.type(telInput, 'ABCD1234');

    submitForm();

    expect(toast.error).toHaveBeenCalledWith(
      'Ingresá un número con código de país (+57...) o un usuario de WhatsApp (@usuario)',
    );
  });

  it('muestra error si saldoPendiente es inválido cuando pagado=false', async () => {
    const user = userEvent.setup();

    // Completar campos obligatorios
    await fillRequiredFields(user, container);

    // Desmarcar pagado (sin poner saldoPendiente)
    await user.click(screen.getByRole('checkbox', { name: /pagó completo/i }));

    submitForm();

    expect(toast.error).toHaveBeenCalledWith(
      'Indicá el saldo pendiente cuando el pago está incompleto.',
    );
  });
});

describe('VentasForm — Submit y Firestore', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let container: HTMLElement;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Mockeamos addDoc/resolves para que todas las promesas resuelvan
    mockAddDoc.mockResolvedValue({ id: 'new-venta-id' });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue(createDocSnapshot('no-existe', null, false));

    const renderResult = render(<VentasForm />);
    container = renderResult.container;
    user = userEvent.setup();
  });

  it('submit exitoso con pagado=true — escribe en ventas, clientes y movimientos', async () => {
    await fillRequiredFields(user, container);

    await user.click(screen.getByRole('button', { name: /registrar venta/i }));

    await waitFor(() => {
      // 2 addDoc: una para ventas, una para movimientos
      expect(mockAddDoc).toHaveBeenCalledTimes(2);
      // 1 setDoc: para clientes (con merge)
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
    });

    // Verificar datos de la venta
    const ventaCalls = mockAddDoc.mock.calls as Array<[unknown, Record<string, unknown>]>;
    const ventaCall = ventaCalls.find(
      ([ref]) => (ref as { _path: string })._path === 'ventas',
    );
    expect(ventaCall).toBeDefined();
    const ventaData = ventaCall![1];
    expect(ventaData.nombre).toBe('Cliente Test');
    expect(ventaData.plataforma).toBe('Netflix');
    expect(ventaData.pagado).toBe(true);
    expect(ventaData.saldoPendiente).toBe(0);
    expect(ventaData.precioVenta).toBe(15000);
    expect(ventaData.costoServicio).toBe(5000);
    expect(ventaData.propietarioId).toBe('test-uid-123');
    expect(ventaData.usuarioEmail).toBe('test@streamcontrol.com');

    // Verificar que NO se llamó a updateDoc (no hay saldo pendiente)
    expect(mockUpdateDoc).not.toHaveBeenCalled();

    // Toast de éxito
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Venta registrada correctamente',
      );
    });
  });

  it('submit exitoso con pagado=false — acumula saldoPendiente en cliente', async () => {
    await fillRequiredFields(user, container);

    // Desmarcar pagado y poner saldo pendiente
    await user.click(screen.getByRole('checkbox', { name: /pagó completo/i }));
    fireEvent.change(getInput(container, 'saldoPendiente'), {
      target: { value: '10000' },
    });

    await user.click(screen.getByRole('button', { name: /registrar venta/i }));

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(2);
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      // updateDoc debe haberse llamado para acumular saldo
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });

    // Verificar que updateDoc usa increment con el monto correcto
    const updateCalls = mockUpdateDoc.mock.calls as Array<[unknown, Record<string, unknown>]>;
    const updateCall = updateCalls[0]!;
    expect((updateCall[0] as { _path: string })._path).toBe('clientes');
    expect(updateCall[1]).toEqual({
      saldoPendiente: { _methodName: 'increment', _value: 10000 },
    });

    // Verificar saldoPendiente en la venta
    const ventaCalls2 = mockAddDoc.mock.calls as Array<[unknown, Record<string, unknown>]>;
    const ventaCall2 = ventaCalls2.find(
      ([ref]) => (ref as { _path: string })._path === 'ventas',
    );
    expect(ventaCall2).toBeDefined();
    expect(ventaCall2![1].pagado).toBe(false);
    expect(ventaCall2![1].saldoPendiente).toBe(10000);
  });
});

describe('VentasForm — Autocompletado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga datos del cliente existente al perder el foco del nombre', async () => {
    const user = userEvent.setup();
    const { container } = render(<VentasForm />);

    // Simular que el cliente existe en Firestore
    mockGetDoc.mockResolvedValue(
      createDocSnapshot('test-uid-123_Cliente Test', {
        telefono: '3007654321',
        correo: 'existente@test.com',
        plataforma: 'Disney+',
      }),
    );

    const nombreInput = screen.getByPlaceholderText('Ej: Juan Pérez');
    await user.type(nombreInput, 'Cliente Test');

    // Perder foco para disparar handleBlurNombre
    fireEvent.blur(nombreInput);

    await waitFor(() => {
      expect(mockGetDoc).toHaveBeenCalled();
    });

    // Verificar que se cargaron los datos del cliente
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ej: +573104567890 o @usuario')).toHaveValue(
        '3007654321',
      );
    });
    expect(
      screen.getByPlaceholderText('email de la cuenta (Netflix...)'),
    ).toHaveValue('existente@test.com');
    expect(
      screen.getByPlaceholderText('Ej: Netflix, Disney+, Spotify...'),
    ).toHaveValue('Disney+');
  });
});

describe('VentasForm — Cálculo de utilidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('actualiza la utilidad estimada al cambiar pantallas, precio o costo', async () => {
    const user = userEvent.setup();
    const { container } = render(<VentasForm />);

    // Default: pantallas=1, precioVenta=0, costoServicio=0 → utilidad=0
    expect(screen.getByText('$0')).toBeInTheDocument();

    // Cambiar a pantallas=2, precioVenta=15000, costoServicio=5000
    // Utilidad = (2 × 15000) - 5000 = 25000
    fireEvent.change(getInput(container, 'pantallas'), {
      target: { value: '2' },
    });
    fireEvent.change(getInput(container, 'precioVenta'), {
      target: { value: '15000' },
    });
    fireEvent.change(getInput(container, 'costoServicio'), {
      target: { value: '5000' },
    });

    // La utilidad debe mostrar $25.000 (formato es-CO)
    await waitFor(() => {
      expect(screen.getByText('$25.000')).toBeInTheDocument();
    });
  });
});

describe('SelectorCuenta — calcularCostoPorPerfil', () => {
  it('retorna el costo unitario correcto cuando los perfiles están asignados (caso renovación)', async () => {
    const { calcularCostoPorPerfil } = await import('./SelectorCuenta');
    const cuentaPerfilesAsignados: any = {
      id: 'c1',
      costo: 30000,
      tipoVenta: 'perfiles',
      perfiles: [
        { nombre: 'Perfil 1', pin: '1111', estado: 'asignado' },
        { nombre: 'Perfil 2', pin: '2222', estado: 'asignado' },
        { nombre: 'Perfil 3', pin: '3333', estado: 'asignado' },
        { nombre: 'Perfil 4', pin: '4444', estado: 'asignado' },
        { nombre: 'Perfil 5', pin: '5555', estado: 'asignado' },
      ],
    };

    // 30000 / 5 = 6000 (NO 30000)
    expect(calcularCostoPorPerfil(cuentaPerfilesAsignados)).toBe(6000);
  });

  it('retorna el costo total cuando el tipo de venta es completa', async () => {
    const { calcularCostoPorPerfil } = await import('./SelectorCuenta');
    const cuentaCompleta: any = {
      id: 'c2',
      costo: 45000,
      tipoVenta: 'completa',
      perfiles: [],
    };

    expect(calcularCostoPorPerfil(cuentaCompleta)).toBe(45000);
  });
});

describe('VentasForm — Renovación con initialData', () => {
  it('precarga correctamente los datos de la última venta del cliente', async () => {
    const { container } = render(
      <VentasForm
        initialData={{
          nombre: 'Cliente Renovar',
          telefono: '+573119876543',
          plataforma: 'Max',
          precioVenta: 18000,
          costoServicio: 6000,
          perfilNombre: 'Perfil 1',
          perfiles: [{ nombre: 'Perfil 1', pin: '9999' }],
        }}
      />,
    );

    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('Cliente Renovar');
    expect(screen.getByPlaceholderText('Ej: +573104567890 o @usuario')).toHaveValue('+573119876543');
    expect(getInput(container, 'precioVenta')).toHaveValue(18000);
    expect(getInput(container, 'costoServicio')).toHaveValue(6000);
    expect(screen.getByPlaceholderText('Principal')).toHaveValue('Perfil 1');
    expect(screen.getByPlaceholderText('1234')).toHaveValue('9999');

    // Utilidad esperada: 18000 - 6000 = 12000
    await waitFor(() => {
      expect(screen.getByText('$12.000')).toBeInTheDocument();
    });
  });
});

describe('VentasForm — Cuota de Clientes PLG', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'new-venta-id' });
    mockSetDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('rechaza el cliente #21 cuando un usuario Starter alcanza el límite de 20 clientes', async () => {
    mockUsePermisos.mockReturnValue({
      ...mockPermisos,
      clienteLimit: 20,
    });
    // Cliente nuevo no existe
    mockGetDoc.mockResolvedValue(createDocSnapshot('no-existe', null, false));
    // Conteo actual en 20 clientes
    mockGetDocs.mockResolvedValue({ empty: false, docs: Array(20).fill({}), size: 20 });

    const { container } = render(<VentasForm />);
    const user = userEvent.setup();

    await fillRequiredFields(user, container);
    await user.click(screen.getByRole('button', { name: /registrar venta/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Alcanzaste el límite de 20 clientes del plan Starter. Actualizá a Professional para clientes ilimitados.',
      );
    });

    // NO debe escribir en Firestore
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('permite la venta si el cliente ya existe aunque haya 20 clientes registrados', async () => {
    mockUsePermisos.mockReturnValue({
      ...mockPermisos,
      clienteLimit: 20,
    });
    // Cliente existente en Firestore
    mockGetDoc.mockResolvedValue(createDocSnapshot('test-uid-123_Cliente Test', {
      nombre: 'Cliente Test',
      telefono: '+573001234567',
      correo: 'test@example.com',
      plataforma: 'Netflix',
    }, true));
    // Conteo actual en 20 clientes y query por teléfono retorna el mismo cliente
    mockGetDocs.mockImplementation(() =>
      Promise.resolve({
        empty: false,
        docs: [
          createDocSnapshot('test-uid-123_Cliente Test', {
            nombre: 'Cliente Test',
            telefono: '+573001234567',
          }),
        ],
        size: 20,
      })
    );

    const { container } = render(<VentasForm />);

    fireEvent.change(screen.getByPlaceholderText('Ej: Juan Pérez'), { target: { value: 'Cliente Test' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: +573104567890 o @usuario'), { target: { value: '+573001234567' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Netflix, Disney+, Spotify...'), { target: { value: 'Netflix' } });
    fireEvent.change(getInput(container, 'pantallas'), { target: { value: '2' } });
    fireEvent.change(getInput(container, 'fechaInicio'), { target: { value: '2026-07-01' } });
    fireEvent.change(getInput(container, 'diasServicio'), { target: { value: '30' } });
    fireEvent.change(getInput(container, 'precioVenta'), { target: { value: '15000' } });
    fireEvent.change(getInput(container, 'costoServicio'), { target: { value: '5000' } });

    fireEvent.click(screen.getByRole('button', { name: /registrar venta/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Venta registrada correctamente');
    });

    expect(mockAddDoc).toHaveBeenCalled();
  });
});
