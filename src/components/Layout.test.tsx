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

describe('Layout — Responsive Sidebar Drawer & Logout Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRol = 'usuario';
  });

  it('renders navigation links, plan badge, user email, and sticky logout button', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Layout>
          <div>Child Content</div>
        </Layout>
      </MemoryRouter>
    );

    // Verify main content is rendered
    expect(screen.getByText('Child Content')).toBeTruthy();

    // Verify User info & Plan
    expect(screen.getByText('owner@streamcontrol.com')).toBeTruthy();
    expect(screen.getByText('Enterprise')).toBeTruthy();

    // Verify Logout button exists and works
    const logoutBtn = screen.getByRole('button', { name: /cerrar sesión/i });
    expect(logoutBtn).toBeTruthy();
    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);

    // Verify Sidebar Structure: flex-col, h-full, max-h-screen
    const aside = container.querySelector('aside');
    expect(aside).toBeTruthy();
    expect(aside?.className).toContain('flex');
    expect(aside?.className).toContain('flex-col');
    expect(aside?.className).toContain('h-full');
    expect(aside?.className).toContain('max-h-screen');

    // Verify scrollable navigation wrapper
    const scrollContainer = container.querySelector('.overflow-y-auto.overscroll-contain');
    expect(scrollContainer).toBeTruthy();

    // Verify sticky footer container
    const stickyFooter = container.querySelector('.sticky.bottom-0');
    expect(stickyFooter).toBeTruthy();
  });

  it('toggles mobile sidebar menu when hamburger button is clicked', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Layout>
          <div>Child Content</div>
        </Layout>
      </MemoryRouter>
    );

    const aside = container.querySelector('aside');
    // Initially closed on mobile (-translate-x-full)
    expect(aside?.className).toContain('-translate-x-full');

    // Click mobile menu button
    const menuBtn = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(menuBtn);

    // Sidebar should now be open (translate-x-0)
    expect(aside?.className).toContain('translate-x-0');
  });
});
