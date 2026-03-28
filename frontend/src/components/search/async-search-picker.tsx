'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';

export interface SearchGroup<T> {
  id: string;
  label: string;
  items: T[];
}

interface AsyncSearchPickerProps<T> {
  label?: string;
  placeholder?: string;
  initialValue?: string;
  minQueryLength?: number;
  debounceMs?: number;
  helperText?: string;
  loadingLabel?: string;
  searchFn: (query: string) => Promise<SearchGroup<T>[]>;
  getItemKey: (item: T) => string;
  getSelectedLabel?: (item: T) => string;
  renderItem: (item: T, active: boolean) => ReactNode;
  onSelect: (item: T) => void;
  footerAction?: {
    label: string;
    onClick: () => void;
  };
  emptyState?: {
    title: string;
    message: string;
  };
}

export function AsyncSearchPicker<T>({
  label,
  placeholder = 'Pesquisar...',
  initialValue = '',
  minQueryLength = 2,
  debounceMs = 300,
  helperText,
  loadingLabel = 'A procurar...',
  searchFn,
  getItemKey,
  getSelectedLabel,
  renderItem,
  onSelect,
  footerAction,
  emptyState = {
    title: 'Sem resultados',
    message: 'Nenhum resultado corresponde à pesquisa atual.',
  },
}: AsyncSearchPickerProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialValue);
  const [groups, setGroups] = useState<SearchGroup<T>[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minQueryLength) {
      setGroups([]);
      setError(null);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      setOpen(true);

      try {
        const nextGroups = await searchFn(trimmed);
        if (!cancelled) {
          setGroups(nextGroups);
          setActiveIndex(nextGroups.some((group) => group.items.length > 0) ? 0 : -1);
        }
      } catch (err) {
        if (!cancelled) {
          setGroups([]);
          setActiveIndex(-1);
          setError(err instanceof Error ? err.message : 'Não foi possível concluir a pesquisa.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [debounceMs, minQueryLength, query, searchFn]);

  const flattenedItems = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ groupId: group.id, item }))),
    [groups]
  );

  const retrySearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < minQueryLength) {
      return;
    }

    setLoading(true);
    setError(null);
    setOpen(true);
    try {
      const nextGroups = await searchFn(trimmed);
      setGroups(nextGroups);
      setActiveIndex(nextGroups.some((group) => group.items.length > 0) ? 0 : -1);
    } catch (err) {
      setGroups([]);
      setActiveIndex(-1);
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a pesquisa.');
    } finally {
      setLoading(false);
    }
  };

  const shouldShowDropdown =
    open &&
    (loading || !!error || query.trim().length >= minQueryLength || !!footerAction);

  return (
    <div ref={rootRef} className="relative">
      {label && <Label className="text-xs text-gray-500">{label}</Label>}
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!shouldShowDropdown || flattenedItems.length === 0) {
              if (event.key === 'Escape') {
                setOpen(false);
              }
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((prev) => (prev + 1) % flattenedItems.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((prev) => (prev <= 0 ? flattenedItems.length - 1 : prev - 1));
            } else if (event.key === 'Enter' && activeIndex >= 0) {
              event.preventDefault();
              const selected = flattenedItems[activeIndex];
              if (selected) {
                if (getSelectedLabel) {
                  setQuery(getSelectedLabel(selected.item));
                }
                onSelect(selected.item);
                setOpen(false);
              }
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {helperText && <p className="mt-1 text-xs text-slate-400">{helperText}</p>}

      {shouldShowDropdown && (
        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingLabel}
            </div>
          ) : error ? (
            <div className="p-3">
              <ErrorState
                compact
                title="Não foi possível pesquisar"
                message={error}
                onRetry={retrySearch}
                secondaryAction={footerAction ? { label: footerAction.label, onClick: footerAction.onClick } : undefined}
              />
            </div>
          ) : groups.every((group) => group.items.length === 0) ? (
            <div className="space-y-3 px-4 py-4">
              {query.trim().length < minQueryLength ? (
                <p className="text-sm text-slate-500">
                  Digita pelo menos {minQueryLength} caracteres para começar a pesquisa.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold text-[#0A2540]">{emptyState.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{emptyState.message}</p>
                  </div>
                  {footerAction && (
                    <button
                      type="button"
                      onClick={footerAction.onClick}
                      className="text-sm font-medium text-[#0A2540] underline underline-offset-4"
                    >
                      {footerAction.label}
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="py-2">
              {groups.map((group) =>
                group.items.length > 0 ? (
                  <div key={group.id} className="px-2 pb-2">
                    <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const itemIndex = flattenedItems.findIndex((entry) => entry.item === item);
                        const active = itemIndex === activeIndex;

                        return (
                          <button
                            key={getItemKey(item)}
                            type="button"
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => {
                              if (getSelectedLabel) {
                                setQuery(getSelectedLabel(item));
                              }
                              onSelect(item);
                              setOpen(false);
                            }}
                            className={cn(
                              'w-full rounded-xl px-3 py-2 text-left transition-colors',
                              active ? 'bg-[#EEF4FF]' : 'hover:bg-slate-50'
                            )}
                          >
                            {renderItem(item, active)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null
              )}

              {footerAction && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <button
                    type="button"
                    onClick={footerAction.onClick}
                    className="text-sm font-medium text-[#0A2540] underline underline-offset-4"
                  >
                    {footerAction.label}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
