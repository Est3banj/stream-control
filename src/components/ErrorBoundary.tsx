import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error no controlado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Si es un error de chunk (lazy loading falló), recargar
      if (this.state.error?.name === 'ChunkLoadError') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-50 p-4">
            <div className="card max-w-md w-full text-center space-y-4">
              <AlertTriangle size={48} className="mx-auto text-yellow-500" />
              <h2 className="text-xl font-bold text-gray-900">Error de carga</h2>
              <p className="text-gray-600">
                No se pudo cargar un componente de la aplicación. Puede ser un problema de conexión o de versión.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary inline-flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Recargar página
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-indigo-50 p-4">
          <div className="card max-w-md w-full text-center space-y-4">
            <AlertTriangle size={48} className="mx-auto text-red-500" />
            <h2 className="text-xl font-bold text-gray-900">Algo salió mal</h2>
            <p className="text-gray-600">
              Ocurrió un error inesperado. Nuestro equipo ha sido notificado.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
