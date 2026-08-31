import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

interface Action {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

interface DropdownMenuProps {
  actions: Action[];
}

export default function DropdownMenu({ actions }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        title="Acciones"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-slate-900 rounded-xl shadow-2xl border border-slate-800 py-1.5 animate-scale-in origin-top-right">
          {actions
            .filter(a => a !== null)
            .map((action, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (!action.disabled) {
                    action.onClick();
                    setOpen(false);
                  }
                }}
                disabled={action.disabled}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  action.variant === 'danger'
                    ? 'text-rose-400 hover:bg-rose-950/40 hover:text-rose-300'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                } ${action.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {action.icon && (
                  <span className="flex-shrink-0">{action.icon}</span>
                )}
                <span>{action.label}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
