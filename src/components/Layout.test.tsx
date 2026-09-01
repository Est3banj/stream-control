import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Layout from './Layout';
import { MemoryRouter } from 'react-router-dom';

const mockLogout = vi.fn();
let mockRol = 'usuario';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', email: 'owner@streamcontrol.com', rol: mockRol },
    logout: mockLogout,
  }),
}));

vi.mock('../hooks/usePermisos', () => ({
  default: () => ({
    planNombre: 'Enterprise',
    loading: false,
    puedeVerDashboardEjecutivo: true,
    puedeExportarExcel: true,
    puedeGestionarCuentas: true,
  }),
}));

vi.mock('../hooks/useBroadcastBanner', () => ({
  default: () => <div data-testid="broadcast-banner" />,
  useBroadcastBanner: () => ({
    broadcast: { activo: false, mensaje: '', tipo: 'info' },
    loading: false,
  }),
}));

vi.mock('../hooks/useSuscripciones', () => ({
  useSuscripciones: () => ({
    suscripciones: [],
    loading: false,
  }),
}));

vi.mock('../components/PWAInstallButton', () => ({
  default: () => <div data-testid="pwa-install-btn" />,
}));

vi.mock('../components/NotificationsPanel', () => ({
  default: () => <div data-testid="notifications-panel" />,
}));

describe('Layout — Responsive Sidebar & Off-Canvas Mobile Drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRol = 'usuario';
  });

  it('renders children, user info, and navigation links in both desktop and mobile views', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Child Content</div>
        </Layout>
      </MemoryRouter>
    );

    // Verify main content is rendered
    expect(screen.getByText('Child Content')).toBeTruthy();

    // Verify User info & Plan
    expect(screen.getAllByText('owner@streamcontrol.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Enterprise').length).toBeGreaterThanOrEqual(1);

    // Verify Logout button exists and works
    const logoutBtns = screen.getAllByRole('button', { name: /cerrar sesión/i });
    expect(logoutBtns.length).toBe(2); // One in desktop sidebar, one in mobile drawer
    fireEvent.click(logoutBtns[0]);
    expect(mockLogout).toHaveBeenCalledTimes(1);

    // Verify Desktop Aside: hidden lg:flex, h-screen, sticky top-0
    const desktopAside = container.querySelector('aside.hidden.lg\\:flex');
    expect(desktopAside).toBeTruthy();
    expect(desktopAside?.className).toContain('w-64');
    expect(desktopAside?.className).toContain('h-screen');
    expect(desktopAside?.className).toContain('sticky');

    // Verify Mobile Drawer Aside: lg:hidden, fixed inset-y-0
    const mobileAside = container.querySelector('aside.lg\\:hidden');
    expect(mobileAside).toBeTruthy();
    expect(mobileAside?.className).toContain('-translate-x-full');
  });

  it('toggles mobile drawer open and closed via hamburger and close button', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Child Content</div>
        </Layout>
      </MemoryRouter>
    );

    const mobileAside = container.querySelector('aside.lg\\:hidden');
    expect(mobileAside?.className).toContain('-translate-x-full');

    // Open mobile menu
    const menuBtn = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(menuBtn);
    expect(mobileAside?.className).toContain('translate-x-0');

    // Close mobile menu via X button
    const closeBtn = screen.getByRole('button', { name: /cerrar menú/i });
    fireEvent.click(closeBtn);
    expect(mobileAside?.className).toContain('-translate-x-full');
  });

  it('closes mobile drawer when clicking on backdrop', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Child Content</div>
        </Layout>
      </MemoryRouter>
    );

    const mobileAside = container.querySelector('aside.lg\\:hidden');

    // Open mobile menu
    const menuBtn = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(menuBtn);
    expect(mobileAside?.className).toContain('translate-x-0');

    // Find backdrop overlay and click it
    const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/70');
    expect(backdrop).toBeTruthy();
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(mobileAside?.className).toContain('-translate-x-full');
  });

  it('closes mobile drawer when clicking a navigation link in mobile drawer', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Layout>
          <div>Child Content</div>
        </Layout>
      </MemoryRouter>
    );

    const mobileAside = container.querySelector('aside.lg\\:hidden');

    // Open mobile menu
    const menuBtn = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(menuBtn);
    expect(mobileAside?.className).toContain('translate-x-0');

    // Click a navigation link inside mobile drawer
    const ventasLinks = screen.getAllByRole('link', { name: /ventas/i });
    expect(ventasLinks.length).toBeGreaterThan(0);
    fireEvent.click(ventasLinks[ventasLinks.length - 1]);

    expect(mobileAside?.className).toContain('-translate-x-full');
  });
});

