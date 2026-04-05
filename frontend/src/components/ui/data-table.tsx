'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface ColumnDef<T> {
  /** Unique key — used for sort state; should match a key of T when sortable */
  key: string;
  header: React.ReactNode;
  /** Render function for cell content */
  cell: (row: T) => React.ReactNode;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Extra Tailwind classes for both <th> and <td> */
  className?: string;
  /** Hide below certain breakpoints — e.g. "hidden md:table-cell" */
  responsive?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Key extractor for React list keys */
  getRowKey: (row: T) => string | number;
  /** Whether data is being loaded (shows skeleton rows) */
  isLoading?: boolean;
  /** Number of skeleton rows to show while loading */
  skeletonRows?: number;
  /** Enable row selection — returns selected row keys */
  selectable?: boolean;
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Pagination — leave undefined to disable */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  /** Server-side sort — called when header is clicked */
  onSortChange?: (key: string, direction: SortDirection) => void;
  /** Client-side sort comparator — if provided AND onSortChange is not, sorts locally */
  sortComparator?: (a: T, b: T, key: string, direction: SortDirection) => number;
  /** Empty state props */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  /** Variant for the empty state */
  emptyVariant?: 'empty' | 'no-results';
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  skeletonRows = 5,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  pagination,
  onSortChange,
  sortComparator,
  emptyTitle = 'Sem dados',
  emptyDescription,
  emptyAction,
  emptyVariant = 'empty',
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const handleSort = (key: string) => {
    const newDir: SortDirection = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(newDir);
    onSortChange?.(key, newDir);
  };

  // Apply client-side sort if no server-side handler
  let displayData = data;
  if (!onSortChange && sortComparator && sortKey) {
    displayData = [...data].sort((a, b) => sortComparator(a, b, sortKey, sortDir));
  }

  // Row selection helpers
  const allKeys = displayData.map(getRowKey);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedKeys?.has(k));
  const someSelected = allKeys.some((k) => selectedKeys?.has(k));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allKeys));
    }
  };

  const toggleRow = (key: string | number) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  // Pagination
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-[#0049e6] focus:ring-[#0049e6]"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.className, col.responsive)}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-[#0A2540] transition-colors"
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i}>
                  {selectable && <TableCell><div className="h-4 w-4 animate-pulse rounded bg-slate-200" /></TableCell>}
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(col.responsive)}>
                      <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : displayData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="p-0">
                  <EmptyState
                    variant={emptyVariant}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                    compact
                  />
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((row) => {
                const key = getRowKey(row);
                const isSelected = selectedKeys?.has(key) ?? false;
                return (
                  <TableRow
                    key={key}
                    data-state={isSelected ? 'selected' : undefined}
                    className={isSelected ? 'bg-[#EEF4FF]' : undefined}
                  >
                    {selectable && (
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-[#0049e6] focus:ring-[#0049e6]"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          aria-label="Seleccionar linha"
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key} className={cn(col.className, col.responsive)}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="text-xs text-slate-400">
            {pagination.total} registo{pagination.total !== 1 ? 's' : ''} · página {pagination.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="gap-1 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Seguinte
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Selection count */}
      {selectable && selectedKeys && selectedKeys.size > 0 && (
        <div className="border-t border-slate-200 bg-[#EEF4FF] px-4 py-2.5 text-sm font-medium text-[#0049e6]">
          {selectedKeys.size} linha{selectedKeys.size !== 1 ? 's' : ''} selecionada{selectedKeys.size !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
