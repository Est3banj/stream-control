import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import VerificarEmail from './VerificarEmail';

interface PrivateRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

export default function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-700 dark:text-gray-200">
        Verificando sesión...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Email sin verificar → bloqueo total (excepto admins y Google que ya verifica)
  const isVerified = Boolean(user.emailVerified || user.rol === 'admin');
  if (!isVerified) {
    return <Navigate to="/verificar-email" replace />;
  }

  if (roles && !user.rol) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-700 dark:text-gray-200">
        Cargando permisos...
      </div>
    );
  }

  if (roles && user.rol && !roles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
