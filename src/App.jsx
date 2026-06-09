import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/Auth/PrivateRoute';
import Layout from './components/Layout';
import Login from './components/Auth/Login';
import ErrorBoundary from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Ventas = lazy(() => import('./pages/Ventas'));
const Reportes = lazy(() => import('./pages/Reportes'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const GestionClientes = lazy(() => import('./pages/GestionClientes'));
const TelegramConfig = lazy(() => import('./pages/TelegramConfig'));

export default function App() {
  return (
    <BrowserRouter>
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
              <PrivateRoute roles={['admin', 'usuario']}>
                <Layout>
                  <Ventas />
                </Layout>
              </PrivateRoute>
            }
          />

          <Route
            path="/reportes"
            element={
              <PrivateRoute roles={['admin', 'usuario']}>
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
              <PrivateRoute roles={['admin', 'usuario']}>
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
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}