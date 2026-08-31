import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginadorProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export default function Paginador({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange }: PaginadorProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-slate-400">
          Mostrando <span className="font-medium text-slate-200">{startItem}</span>
          <span className="text-slate-500">–</span>
          <span className="font-medium text-slate-200">{endItem}</span>{' '}
          <span className="text-slate-500">de</span>{' '}
          <span className="font-medium text-slate-200">{totalItems}</span>{' '}
          registros
        </p>

        {onItemsPerPageChange && (
          <select
            value={itemsPerPage}
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value));
            }}
            className="w-auto text-sm px-2.5 py-1 rounded-xl border border-slate-800 bg-slate-900 text-slate-200 cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
            aria-label="Registros por página"
          >
            <option value={10} className="bg-slate-900 text-slate-200">10 / pág</option>
            <option value={20} className="bg-slate-900 text-slate-200">20 / pág</option>
            <option value={50} className="bg-slate-900 text-slate-200">50 / pág</option>
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Página anterior"
        >
          <ChevronLeft size={18} />
        </button>

        {getPageNumbers().map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
              page === currentPage
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800 bg-slate-900/40'
            }`}
            aria-label={`Ir a página ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Página siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
