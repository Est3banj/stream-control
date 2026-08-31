import React, { useRef, useEffect } from 'react';

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  hasError = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Array de dígitos individuales según length
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  // Auto-focus en el primer input vacío al montar
  useEffect(() => {
    if (!disabled) {
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
      inputRefs.current[targetIndex]?.focus();
    }
  }, []);

  const handleChange = (index: number, char: string) => {
    if (disabled) return;
    const cleanChar = char.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanChar;
    const newValue = newDigits.join('');
    onChange(newValue);

    if (cleanChar && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newValue.length === length && onComplete) {
      onComplete(newValue);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const cleanNumbers = pastedData.replace(/\D/g, '').slice(0, length);
    if (!cleanNumbers) return;

    onChange(cleanNumbers);
    const nextFocusIndex = Math.min(cleanNumbers.length, length - 1);
    inputRefs.current[nextFocusIndex]?.focus();

    if (cleanNumbers.length === length && onComplete) {
      onComplete(cleanNumbers);
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-4 select-none">
      {Array.from({ length }).map((_, index) => {
        const isFilled = Boolean(digits[index]);
        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label={`Dígito ${index + 1}`}
            value={digits[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-mono font-bold rounded-2xl border transition-all duration-200 outline-none shadow-sm
              ${
                hasError
                  ? 'border-red-500 bg-red-500/10 text-red-200 focus:ring-2 focus:ring-red-400/30'
                  : isFilled
                  ? 'border-indigo-500/50 bg-slate-950/80 text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25'
                  : 'border-slate-800 bg-slate-950/60 text-white placeholder-slate-600 hover:border-slate-700 focus:border-indigo-400 focus:bg-slate-950/80 focus:ring-2 focus:ring-indigo-500/25'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          />
        );
      })}
    </div>
  );
};

export default OtpInput;
