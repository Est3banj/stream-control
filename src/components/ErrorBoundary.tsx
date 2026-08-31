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
          <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl max-w-md w-full text-center space-y-4 p-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400 mx-auto mb-2">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white">Error de carga</h2>
              <p className="text-slate-400 text-sm">
                No se pudo cargar un componente de la aplicación. Puede ser un problema de conexión o de versión.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary inline-flex items-center gap-2 shadow-lg shadow-indigo-950/50"
              >
                <RefreshCw size={18} />
                Recargar página
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden">
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl max-w-md w-full text-center space-y-4 p-8">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-800/40 flex items-center justify-center text-rose-400 mx-auto mb-2">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">Algo salió mal</h2>
            <p className="text-slate-400 text-sm">
              Ocurrió un error inesperado. Podés intentar recargar la aplicación.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary inline-flex items-center gap-2 shadow-lg shadow-indigo-950/50"
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
