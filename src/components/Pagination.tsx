import React, { useState, useRef, useEffect } from 'react';
import { ChevronsRight, ChevronDown } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const [jumpToPage, setJumpToPage] = useState('');
  const jumpRef = useRef<HTMLDivElement>(null);

  // Helper to change page and scroll to top
  // Using 'auto' (instant) instead of 'smooth' for better mobile UX
  // Smooth scroll causes jarring experience on mobile where users briefly
  // see bottom listings before the animation completes
  const handlePageChange = (page: number) => {
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (jumpRef.current && !jumpRef.current.contains(event.target as Node)) {
        setIsJumpOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpToPage);
    if (pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
      setIsJumpOpen(false);
      setJumpToPage('');
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const delta = 2; // Number of pages to show on each side of current
    const range = [];
    const rangeWithDots = [];

    // Always show 1
    // Always show last page
    // Show current +/- delta

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    let l;
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    // Special case for small counts to ensure we just list them key
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 py-8 select-none">

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {getPageNumbers().map((page, idx) => {
          if (page === '...') {
            return <span key={`dots-${idx}`} className="px-2 text-gray-400">...</span>;
          }

          const isCurrent = page === currentPage;
          return (
            <button
              key={page}
              onClick={() => handlePageChange(Number(page))}
              className={`min-w-[32px] h-8 sm:min-w-[40px] sm:h-10 flex items-center justify-center rounded-md text-sm font-bold transition-all duration-200
                ${isCurrent
                  ? 'bg-gray-800 text-white shadow-md transform scale-105'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next & Last Buttons */}
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-10 px-3 flex items-center gap-1 text-sm font-bold text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          NEXT
        </button>
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="h-10 w-10 flex items-center justify-center text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Last Page"
        >
          <ChevronsRight className="w-5 h-5" />
        </button>
      </div>

      {/* Jump To Page Dropdown */}
      <div className="relative ml-4 sm:ml-8" ref={jumpRef}>
        <button
          onClick={() => setIsJumpOpen(!isJumpOpen)}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
        >
          Page {currentPage} of {totalPages}
          <ChevronDown className="w-4 h-4" />
        </button>

        {isJumpOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-4 animate-fade-in-up z-50">
            {/* Little arrow at bottom */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-gray-100 transform rotate-45"></div>

            <form onSubmit={handleJump} className="relative z-10 flex flex-col gap-3">
              <input
                type="number"
                min="1"
                max={totalPages}
                placeholder="Page number"
                value={jumpToPage}
                onChange={(e) => setJumpToPage(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded-md transition-colors"
              >
                Go
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
