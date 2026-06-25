import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/Auth/PrivateRoute';
import Layout from './components/Layout';
import Login from './components/Auth/Login';
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

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <AnalyticsTracker />
      <ErrorBoundary>
        <Suspense fallback={<div className="container">Cargando...</div>}>
          <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

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
            path="/GestionClientes"
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

          {/* Catch-all: redirigir a dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
