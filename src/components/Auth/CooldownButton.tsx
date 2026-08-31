import React, { useState, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface CooldownButtonProps {
  onClick: () => Promise<void> | void;
  durationSeconds?: number;
  label?: string;
  loading?: boolean;
  className?: string;
  storageKey?: string;
  autoStart?: boolean;
}

export const CooldownButton: React.FC<CooldownButtonProps> = ({
  onClick,
  durationSeconds = 60,
  label = 'Reenviar correo',
  loading = false,
  className = '',
  storageKey = 'sc_email_cooldown_until',
  autoStart = false,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const diff = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
      }
      if (autoStart) {
        const until = Date.now() + durationSeconds * 1000;
        sessionStorage.setItem(storageKey, String(until));
        return durationSeconds;
      }
    } catch {
      // Ignorar errores de sessionStorage
    }
    return 0;
  });

  const startCooldown = useCallback((seconds: number = durationSeconds) => {
    const until = Date.now() + seconds * 1000;
    try {
      sessionStorage.setItem(storageKey, String(until));
    } catch {
      // Ignorar
    }
    setRemainingSeconds(seconds);
  }, [durationSeconds, storageKey]);

  useEffect(() => {
    if (remainingSeconds <= 0) return;

    const intervalId = setInterval(() => {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const diff = Math.ceil((parseInt(stored, 10) - Date.now()) / 1000);
          if (diff <= 0) {
            sessionStorage.removeItem(storageKey);
            setRemainingSeconds(0);
          } else {
            setRemainingSeconds(diff);
          }
          return;
        }
      } catch {
        // Fallback
      }

      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem(storageKey);
          } catch {
            // Ignorar
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [remainingSeconds, storageKey]);

  const handleClick = async () => {
    if (remainingSeconds > 0 || loading) return;
    try {
      await onClick();
      startCooldown(durationSeconds);
    } catch {
      // Si falla, el consumidor maneja el error toast
    }
  };

  const isCoolingDown = remainingSeconds > 0;
  const isDisabled = isCoolingDown || loading;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`relative overflow-hidden w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-semibold transition-all duration-300 shadow-md ${
        isDisabled
          ? 'bg-white/10 text-white/40 border border-white/10 cursor-not-allowed'
          : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-violet-600 hover:to-indigo-600 text-white hover:shadow-indigo-500/25 active:scale-[0.99]'
      } ${className}`}
    >
      {/* Barra de progreso de cooldown visual de fondo */}
      {isCoolingDown && (
        <div
          className="absolute left-0 bottom-0 top-0 bg-white/5 transition-all duration-1000 ease-linear pointer-events-none"
          style={{
            width: `${((durationSeconds - remainingSeconds) / durationSeconds) * 100}%`,
          }}
        />
      )}

      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin text-white/70" />
          <span>Enviando...</span>
        </>
      ) : isCoolingDown ? (
        <>
          <Send className="w-4 h-4 text-white/40" />
          <span>{label} ({remainingSeconds}s)</span>
        </>
      ) : (
        <>
          <Send className="w-4 h-4" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

export default CooldownButton;
