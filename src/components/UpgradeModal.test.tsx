import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUsePermisos = vi.fn();

vi.mock('../hooks/usePermisos', async () => {
  const actual = await vi.importActual<typeof import('../hooks/usePermisos')>(
    '../hooks/usePermisos',
  );
  return {
    ...actual,
    default: (...args: unknown[]) => mockUsePermisos(...args),
  };
});

vi.mock('../hooks/useSuscripciones', () => ({
  default: () => ({ suscripciones: [], loading: false, error: null }),
}));

vi.mock('../hooks/usePlanes', () => ({
  default: () => ({ planes: [], loading: false, error: null }),
}));

vi.mock('../hooks/useAdminConfig', () => ({
  useAdminConfig: () => ({ config: { whatsapp: '' }, loading: false }),
  sanitizarWhatsApp: (n: string) => n.replace(/[^0-9]/g, ''),
}));

const starterPermisos = {
  planNombre: 'Starter',
  loading: false,
  clienteLimit: 30,
  puedeUsarTelegram: false,
  puedeVerReportesAvanzados: false,
  puedeExportarExcel: true,
  puedeVerDashboardEjecutivo: false,
  tieneSoportePrioritario: false,
  tieneSoporte247: false,
};

const professionalPermisos = {
  planNombre: 'Professional',
  loading: false,
  clienteLimit: Infinity,
  puedeUsarTelegram: true,
  puedeVerReportesAvanzados: true,
  puedeExportarExcel: true,
  puedeVerDashboardEjecutivo: false,
  tieneSoportePrioritario: true,
  tieneSoporte247: false,
};

const enterprisePermisos = {
  planNombre: 'Enterprise',
  loading: false,
  clienteLimit: Infinity,
  puedeUsarTelegram: true,
  puedeVerReportesAvanzados: true,
  puedeExportarExcel: true,
  puedeVerDashboardEjecutivo: true,
  tieneSoportePrioritario: true,
  tieneSoporte247: true,
};

describe('UpgradeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('Plan detection — all 3 plans always shown', () => {
    it('Starter user sees all 3 plan cards and "Elegir" for non-current', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      // All plan names visible
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();

      // Current plan shows badge, not button
      expect(screen.getByText('Tu plan actual')).toBeInTheDocument();

      // Non-current plans show "Elegir"
      expect(screen.getByText('Elegir Professional')).toBeInTheDocument();
      expect(screen.getByText('Elegir Enterprise')).toBeInTheDocument();
    });

    it('Professional user sees all 3 plan cards', async () => {
      mockUsePermisos.mockReturnValue(professionalPermisos);
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
      expect(screen.getByText('Tu plan actual')).toBeInTheDocument();

      // Only Enterprise is upgrade (Starter would be downgrade but button still shows)
      expect(screen.getByText('Elegir Enterprise')).toBeInTheDocument();
    });

    it('Enterprise user sees all 3 plan cards with current badge', async () => {
      mockUsePermisos.mockReturnValue(enterprisePermisos);
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      // Enterprise now shows all plans (no null)
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
      expect(screen.getByText('Tu plan actual')).toBeInTheDocument();
    });

    it('Admin user sees all 3 plan cards (no null)', async () => {
      mockUsePermisos.mockReturnValue({
        ...enterprisePermisos,
        planNombre: 'Admin',
      });
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      // Admin sees all plans too
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    it('all features appear in each plan card (not just diff)', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      // ALL features are shown now (in plan cards, not just diff table)
      // Each feature appears 3 times (one per plan card)
      expect(screen.getAllByText(/Límite de clientes/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Notificaciones Telegram').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Reportes Avanzados').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Exportar a Excel').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Dashboard Ejecutivo').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Soporte Prioritario').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Soporte 24/7').length).toBeGreaterThanOrEqual(1);
    });

    it('clienteLimit shows "30 clientes" vs "Ilimitado" across plans', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      expect(screen.getByText('30 clientes')).toBeInTheDocument();
      // Ilimitado appears twice (Professional + Enterprise)
      expect(screen.getAllByText('Ilimitado').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Frequency control (sessionStorage)', () => {
    it('sets sessionStorage key on dismiss', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const onClose = vi.fn();

      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={onClose} />);

      fireEvent.click(screen.getByLabelText('Cerrar'));

      expect(setItemSpy).toHaveBeenCalledWith('upgrade_modal_shown', '1');
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Dismissal behavior', () => {
    it('close button calls onClose', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const onClose = vi.fn();

      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={onClose} />);

      fireEvent.click(screen.getByLabelText('Cerrar'));
      expect(onClose).toHaveBeenCalled();
    });

    it('overlay click calls onClose', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const onClose = vi.fn();

      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={onClose} />);

      const card = screen.getByRole('dialog');
      const overlay = card.parentElement!;
      fireEvent.click(overlay);

      expect(onClose).toHaveBeenCalled();
    });

    it('Escape key calls onClose', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const onClose = vi.fn();

      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('clicking INSIDE modal does NOT call onClose', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const onClose = vi.fn();

      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={onClose} />);

      const card = screen.getByRole('dialog');
      fireEvent.click(card);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('loading state returns null (no render)', async () => {
      mockUsePermisos.mockReturnValue({ ...starterPermisos, loading: true });
      const UpgradeModal = (await import('./UpgradeModal')).default;
      const { container } = render(
        <UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />,
      );

      expect(container.innerHTML).toBe('');
    });

    it('unauthenticated user returns null (no render)', async () => {
      mockUsePermisos.mockReturnValue({ ...starterPermisos, planNombre: null });
      const UpgradeModal = (await import('./UpgradeModal')).default;
      const { container } = render(
        <UpgradeModal user={null} onClose={vi.fn()} />,
      );

      expect(container.innerHTML).toBe('');
    });

    it('null plan returns null (no render)', async () => {
      mockUsePermisos.mockReturnValue({ ...starterPermisos, planNombre: null });
      const UpgradeModal = (await import('./UpgradeModal')).default;
      const { container } = render(
        <UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />,
      );

      expect(container.innerHTML).toBe('');
    });
  });

  describe('CTA rendering', () => {
    it('Starter sees "Elegir Professional" and "Elegir Enterprise" CTAs with correct link attributes', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      const ctas = screen.getAllByRole('link', { name: /elegir/i });
      expect(ctas).toHaveLength(2);
      ctas.forEach((cta) => {
        expect(cta).toHaveAttribute('href', expect.stringContaining('mailto:ventas@streamcontrol.com'));
        expect(cta).toHaveAttribute('target', '_blank');
        expect(cta).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('Professional sees "Elegir Enterprise" CTA', async () => {
      mockUsePermisos.mockReturnValue(professionalPermisos);
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      expect(screen.getByText('Elegir Enterprise')).toBeInTheDocument();
      // "Elegir Professional" does NOT exist (it's current plan)
      expect(screen.queryByText('Elegir Professional')).not.toBeInTheDocument();
    });

    it('Ahora no button dismisses modal', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const onClose = vi.fn();

      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={onClose} />);

      fireEvent.click(screen.getByText('Ahora no'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has role="dialog" and aria-modal="true"', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'upgrade-modal-title');
    });

    it('Escape key closes modal from any focus', async () => {
      mockUsePermisos.mockReturnValue(starterPermisos);
      const onClose = vi.fn();

      const UpgradeModal = (await import('./UpgradeModal')).default;
      render(<UpgradeModal user={{ uid: 'test-uid' }} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      dialog.focus();
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
