import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';

let mockAuthState: {
  user: {
    uid: string;
    email: string;
    emailVerified?: boolean;
    rol?: string;
  } | null;
  loading: boolean;
} = {
  user: null,
  loading: false,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

describe('PrivateRoute Route Guard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: null,
      loading: false,
    };
  });

  it('renders loading state while authentication is being checked', () => {
    mockAuthState = {
      user: null,
      loading: true,
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <PrivateRoute>
          <div>Protected Content</div>
        </PrivateRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Verificando sesión...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user to /login', () => {
    mockAuthState = {
      user: null,
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <div>Protected Content</div>
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects unverified regular user to /verificar-email', () => {
    mockAuthState = {
      user: {
        uid: 'user-1',
        email: 'unverified@example.com',
        emailVerified: false,
        rol: 'usuario',
      },
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <div>Protected Content</div>
              </PrivateRoute>
            }
          />
          <Route path="/verificar-email" element={<div>Email Verification Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Email Verification Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows verified regular user into protected route', () => {
    mockAuthState = {
      user: {
        uid: 'user-2',
        email: 'verified@example.com',
        emailVerified: true,
        rol: 'usuario',
      },
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute roles={['usuario']}>
                <div>Protected Dashboard Content</div>
              </PrivateRoute>
            }
          />
          <Route path="/verificar-email" element={<div>Email Verification Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
    expect(screen.queryByText('Email Verification Page')).not.toBeInTheDocument();
  });

  it('allows admin user even if emailVerified is false (admin exemption)', () => {
    mockAuthState = {
      user: {
        uid: 'admin-1',
        email: 'admin@streamcontrol.com',
        emailVerified: false,
        rol: 'admin',
      },
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute roles={['admin']}>
                <div>Admin Dashboard Content</div>
              </PrivateRoute>
            }
          />
          <Route path="/verificar-email" element={<div>Email Verification Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Dashboard Content')).toBeInTheDocument();
  });

  it('redirects unauthorized user to / when role does not match', () => {
    mockAuthState = {
      user: {
        uid: 'user-3',
        email: 'seller@streamcontrol.com',
        emailVerified: true,
        rol: 'usuario',
      },
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route
            path="/admin-only"
            element={
              <PrivateRoute roles={['admin']}>
                <div>Admin Only Section</div>
              </PrivateRoute>
            }
          />
          <Route path="/" element={<div>Root Home</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Root Home')).toBeInTheDocument();
    expect(screen.queryByText('Admin Only Section')).not.toBeInTheDocument();
  });
});
