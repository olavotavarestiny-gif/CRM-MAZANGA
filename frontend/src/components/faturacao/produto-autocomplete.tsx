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
        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 text-sm"
      />
      {hasSelection && onEditCurrent && (
        <button
          type="button"
          onClick={onEditCurrent}
          className="shrink-0 px-2 h-9 rounded-md border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors text-xs"
          title="Editar produto"
        >
          ✏️
        </button>
      )}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-9 bg-zinc-900 border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {produtos.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
              onClick={() => { onChange(p); setSearch(p.productDescription); setOpen(false); }}
            >
              <p className="text-sm font-medium text-white">{p.productDescription}</p>
              <p className="text-xs text-zinc-400">{p.productCode} · {p.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} · IVA {p.taxPercentage}%</p>
            </button>
          ))}
          {onCreateNew && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-purple-500/10 transition-colors border-t border-white/5 flex items-center gap-2"
              onClick={() => { onCreateNew(search); setOpen(false); }}
            >
              <Plus className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-sm text-purple-400">Criar &quot;{search || 'novo produto'}&quot;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
