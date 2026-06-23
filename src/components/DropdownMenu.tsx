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
        className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        title="Acciones"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white rounded-xl shadow-lg border border-gray-200 py-1 animate-scale-in origin-top-right">
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
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
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
