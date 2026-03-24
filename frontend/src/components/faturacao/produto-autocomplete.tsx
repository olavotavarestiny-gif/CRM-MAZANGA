'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import type { Produto } from '@/lib/types';
import { getProdutos } from '@/lib/api';

interface Props {
  onChange: (produto: Produto) => void;
  onCreateNew?: (description: string) => void;
  onEditCurrent?: () => void;
  value?: string;
  placeholder?: string;
  hasSelection?: boolean;
}

export function ProdutoAutocomplete({ onChange, onCreateNew, onEditCurrent, value, placeholder, hasSelection }: Props) {
  const [search, setSearch] = useState(value || '');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (search.length < 1) { setProdutos([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await getProdutos({ search, active: true });
        setProdutos(data);
        setOpen(true);
      } catch { setProdutos([]); setOpen(true); }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDropdown = open && (produtos.length > 0 || (search.length >= 1 && onCreateNew));

  return (
    <div ref={ref} className="relative flex gap-1">
      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => search.length > 0 && setOpen(true)}
        placeholder={placeholder || 'Pesquisar produto...'}
        className="bg-white border-[#E2E8F0] text-[#0A2540] placeholder:text-[#94a3b8] text-sm"
      />
      {hasSelection && onEditCurrent && (
        <button
          type="button"
          onClick={onEditCurrent}
          className="shrink-0 px-2 h-9 rounded-md border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0A2540] hover:bg-[#F8FAFC] transition-colors text-xs"
          title="Editar produto"
        >
          ✏️
        </button>
      )}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-9 bg-white border border-[#E2E8F0] rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {produtos.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] transition-colors"
              onClick={() => { onChange(p); setSearch(p.productDescription); setOpen(false); }}
            >
              <p className="text-sm font-medium text-[#0A2540]">{p.productDescription}</p>
              <p className="text-xs text-[#64748B]">{p.productCode} · {p.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} · IVA {p.taxPercentage}%</p>
            </button>
          ))}
          {onCreateNew && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-violet-50 transition-colors border-t border-[#E2E8F0] flex items-center gap-2"
              onClick={() => { onCreateNew(search); setOpen(false); }}
            >
              <Plus className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <span className="text-sm text-violet-600">Criar &quot;{search || 'novo produto'}&quot;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
