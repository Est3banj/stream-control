import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();

  // Mostrar pantalla de carga mientras se verifica la sesión
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-700 dark:text-gray-200">
        Verificando sesión...
      </div>
    );
  }

  // Si no hay usuario autenticado
  if (!user) return <Navigate to="/login" replace />;

  // Si los roles están definidos y el rol del usuario aún no se ha cargado, no forzar redirección
  if (roles && !user.rol) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-700 dark:text-gray-200">
        Cargando permisos...
      </div>
    );
  }

  // Si hay roles requeridos y el usuario no pertenece a ninguno
  if (roles && user.rol && !roles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}