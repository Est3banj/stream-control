import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/Auth/PrivateRoute';
import Layout from './components/Layout';
import Login from './components/Auth/Login';
import VerificarEmail from './components/Auth/VerificarEmail';
import ErrorBoundary from './components/ErrorBoundary';
import AnalyticsTracker from './components/AnalyticsTracker';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Ventas = lazy(() => import('./pages/Ventas'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const GestionClientes = lazy(() => import('./pages/GestionClientes'));
const TelegramConfig = lazy(() => import('./pages/TelegramConfig'));
const AdminPlanes = lazy(() => import('./pages/AdminPlanes'));
const AdminSuscripciones = lazy(() => import('./pages/AdminSuscripciones'));
const Ajustes = lazy(() => import('./pages/Ajustes'));
const GestionCuentas = lazy(() => import('./pages/GestionCuentas'));
const ConsultaPublica = lazy(() => import('./pages/ConsultaPublica'));
const ConsultaCodigos = lazy(() => import('./pages/ConsultaCodigos'));
const VentasMayoristas = lazy(() => import('./pages/VentasMayoristas'));
const VerificarEmailLink = lazy(() => import('./pages/VerificarEmailLink'));
const RegisterPage = lazy(() => import('./pages/Register'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

/** Handle public consultation route served via Firebase rewrite /r/** → /app/index.html */
function PublicConsulta() {
  const token = window.location.pathname.replace('/r/', '');
  return <ConsultaPublica token={token} />;
}

export default function App() {
  const pathname = window.location.pathname;

  // Public password reset link when accessed without /app prefix
  if (pathname === '/reset-password' || pathname.startsWith('/reset-password/')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950"><div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" /></div>}>
          <ResetPassword />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Public verification link: /r/verificar-email?token=xxx
  if (pathname === '/r/verificar-email') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950"><div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" /></div>}>
          <VerificarEmailLink />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Public consultation links are served via Firebase rewrite to /app/index.html
  // but without /app prefix in the URL — render ConsultaPublica outside BrowserRouter
  if (pathname.startsWith('/r/')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="container">Cargando...</div>}>
          <PublicConsulta />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <BrowserRouter basename="/app">
      <AnalyticsTracker />
      <ErrorBoundary>
        <Suspense fallback={<div className="container">Cargando...</div>}>
          <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verificar-email" element={<VerificarEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Rutas privadas */}
          <Route
            path="/"
            element={
              <PrivateRoute roles={['admin', 'usuario']}>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/ventas"
            element={
              <PrivateRoute roles={['usuario']}>
                <Layout>
                  <Ventas />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/reportes"
            element={
              <PrivateRoute roles={['usuario']}>
                <Layout>
                  <Reportes />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/usuarios"
            element={
              <PrivateRoute roles={['admin']}>
                <Layout>
                  <Usuarios />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/gestion-clientes"
            element={
              <PrivateRoute roles={['usuario']}>
                <Layout>
                  <GestionClientes />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/telegram"
            element={
              <PrivateRoute roles={['admin', 'usuario']}>
                <Layout>
                  <TelegramConfig />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/planes"
            element={
              <PrivateRoute roles={['admin']}>
                <Layout>
                  <AdminPlanes />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin/suscripciones"
            element={
              <PrivateRoute roles={['admin']}>
                <Layout>
                  <AdminSuscripciones />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/ajustes"
            element={
              <PrivateRoute roles={['admin', 'usuario']}>
                <Layout>
                  <Ajustes />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/cuentas"
            element={
              <PrivateRoute roles={['admin', 'usuario']}>
                <Layout>
                  <GestionCuentas />
                </Layout>
              </PrivateRoute>
            }
          />

          {/* Keep this for backward compat: /app/r/:token also works */}
          <Route path="/r/:token" element={<ConsultaPublica />} />

          <Route
            path="/consulta-codigos"
            element={
              <PrivateRoute roles={['admin', 'usuario']}>
                <Layout>
                  <ConsultaCodigos />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/mayoristas"
            element={
              <PrivateRoute roles={['admin', 'usuario']}>
                <Layout>
                  <VentasMayoristas />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route path="/revendedores" element={<Navigate to="/mayoristas" replace />} />

          {/* Catch-all: redirigir a dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
