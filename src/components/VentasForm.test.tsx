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
  serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
  increment: (n: number) => ({ _methodName: 'increment', _value: n }),
}));

const mockUser = { uid: 'test-uid-123', email: 'test@streamcontrol.com' };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
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
  await user.type(screen.getByPlaceholderText('Ej: 3104567890'), '3001234567');
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
    expect(screen.getByPlaceholderText('Ej: 3104567890')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('correo@ejemplo.com')).toBeInTheDocument();
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

    // Checkboxes (fechaVenta toggle + pagado) + botón submit
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
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
    // Sobreescribir teléfono con caracteres no numéricos
    const telInput = screen.getByPlaceholderText('Ej: 3104567890');
    await user.clear(telInput);
    await user.type(telInput, 'ABCD1234');

    submitForm();

    expect(toast.error).toHaveBeenCalledWith(
      'El teléfono solo debe contener números.',
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
      expect(screen.getByPlaceholderText('Ej: 3104567890')).toHaveValue(
        '3007654321',
      );
    });
    expect(
      screen.getByPlaceholderText('correo@ejemplo.com'),
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
