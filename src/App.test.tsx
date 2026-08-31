import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

// Mock dependencies to keep App tests focused on routing
vi.mock('./firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode: vi.fn().mockResolvedValue('user@streamcontrol.pro'),
  confirmPasswordReset: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return () => {};
  }),
}));

vi.mock('./lib/apiClient', () => ({
  callFunction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('App Routing - Public Reset Password & Public Links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('renders ResetPassword component when visiting /reset-password (root path outside /app)', async () => {
    window.history.replaceState(null, '', '/reset-password?oobCode=root-oob-123');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Restablecer contraseña')).toBeInTheDocument();
      expect(screen.getByText('user@streamcontrol.pro')).toBeInTheDocument();
    });
  });

  it('renders ResetPassword component when visiting /r/reset-password (rewrite path outside /app)', async () => {
    window.history.replaceState(null, '', '/r/reset-password?oobCode=rewrite-oob-456');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Restablecer contraseña')).toBeInTheDocument();
      expect(screen.getByText('user@streamcontrol.pro')).toBeInTheDocument();
    });
  });

  it('renders ResetPassword component when visiting /app/reset-password (SPA path inside basename /app)', async () => {
    window.history.replaceState(null, '', '/app/reset-password?oobCode=spa-oob-789');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Restablecer contraseña')).toBeInTheDocument();
      expect(screen.getByText('user@streamcontrol.pro')).toBeInTheDocument();
    });
  });

  it('renders VerificarEmailLink component when visiting /r/verificar-email', async () => {
    window.history.replaceState(null, '', '/r/verificar-email?token=test-token-abc');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('¡Correo verificado!')).toBeInTheDocument();
    });
  });
});
