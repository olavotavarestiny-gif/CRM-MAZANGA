'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  /** Current search string (controlled) */
  search: string;
  onSearchChange: (value: string) => void;
  /** Debounce delay in ms — default 300 */
  debounceMs?: number;
  /** Placeholder for the search input */
  placeholder?: string;
  /** Whether data is loading (shows spinner inside input) */
  isLoading?: boolean;
  /** Extra filter slots rendered to the right of the search input */
  children?: React.ReactNode;
  /** Whether ANY filter (search OR extra) is currently active — shows "Limpar filtros" when true */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  className?: string;
}

/**
 * Reusable filter bar with debounced search, extra filter slots, and a
 * "Limpar filtros" button that appears only when at least one filter is active.
 *
 * Usage:
 *   const [search, setSearch] = useState('');
 *   const [type, setType] = useState('');
 *
 *   <FilterBar
 *     search={search}
 *     onSearchChange={setSearch}
 *     hasActiveFilters={!!search || !!type}
 *     onClearFilters={() => { setSearch(''); setType(''); }}
 *   >
 *     <Select value={type} onValueChange={setType}>…</Select>
 *   </FilterBar>
 */
export function FilterBar({
  search,
  onSearchChange,
  debounceMs = 300,
  placeholder = 'Pesquisar...',
  isLoading = false,
  children,
  hasActiveFilters = false,
  onClearFilters,
  className,
}: FilterBarProps) {
  // Internal input value so we can debounce before calling onSearchChange
  const [inputValue, setInputValue] = useState(search);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep input in sync if parent resets the search externally
  useEffect(() => {
    setInputValue(search);
  }, [search]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearchChange(val);
    }, debounceMs);
  };

  const handleClearInput = () => {
    setInputValue('');
    if (timerRef.current) clearTimeout(timerRef.current);
    onSearchChange('');
  };

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      {/* Search input */}
      <div className="relative flex-1">
        {isLoading ? (
          <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#6b7e9a]" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7e9a]" />
        )}
        <Input
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClearInput}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-[#6b7e9a] transition-colors hover:text-[#0A2540] focus:outline-none"
            aria-label="Limpar pesquisa"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Extra filter slots (selects, date pickers, etc.) */}
      {children && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}

      {/* Clear all filters button — only visible when something is active */}
      {hasActiveFilters && onClearFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="shrink-0 gap-1.5 text-[#6b7e9a] hover:text-[#0A2540]"
        >
          <X className="h-3.5 w-3.5" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
