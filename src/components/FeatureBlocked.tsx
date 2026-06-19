import React, { useEffect, useRef } from 'react';
import { Lock, Sparkles, TrendingUp } from 'lucide-react';
import { useUpgradeModal } from '../contexts/UpgradeModalContext';

interface FeatureBlockedProps {
  feature: string;
  description: string;
  plan: string;
}

export default function FeatureBlocked({ feature, description, plan }: FeatureBlockedProps) {
  const { show } = useUpgradeModal();
  const autoShownRef = useRef(false);

  // Auto-trigger modal al entrar a página bloqueada (1 vez por ruta por sesión)
  useEffect(() => {
    if (autoShownRef.current) return;

    const pageKey = `upgrade_shown_${window.location.pathname}`;
    try {
      if (sessionStorage.getItem(pageKey)) return;
      sessionStorage.setItem(pageKey, 'true');
    } catch {
      // private browsing — seguir sin persistencia
    }

    autoShownRef.current = true;
    const timer = setTimeout(() => show(), 600);
    return () => clearTimeout(timer);
  }, [show]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
        <Lock size={32} className="text-indigo-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{feature}</h3>
      <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">{description}</p>
      <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-semibold shadow-lg">
        <Sparkles size={16} />
        Disponible en {plan}
      </div>
      <div className="mt-6">
        <button
          onClick={show}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all hover:scale-105"
        >
          <TrendingUp size={20} />
          Actualizar plan
        </button>
      </div>
      <p className="text-gray-400 text-xs mt-4">
        Actualizá tu plan para acceder a esta funcionalidad.
      </p>
    </div>
  );
}
