'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ClienteFaturacao } from '@/lib/types';
import { getClientesFaturacao } from '@/lib/api';

interface Props {
  onChange: (cliente: ClienteFaturacao) => void;
  value?: string;
}

export function ClienteAutocomplete({ onChange, value }: Props) {
  const [search, setSearch] = useState(value || '');
  const [clientes, setClientes] = useState<ClienteFaturacao[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (search.length < 2) { setClientes([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getClientesFaturacao({ search });
        setClientes(data.clientes);
        setOpen(true);
      } catch { setClientes([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Label className="text-xs text-gray-500">Cliente (nome ou NIF)</Label>
      <Input
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => clientes.length > 0 && setOpen(true)}
        placeholder="Pesquisar cliente..."
        className="mt-1 text-[#0A2540] placeholder:text-gray-400"
      />
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-gray-500">A procurar...</div>}
          {!loading && clientes.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">Nenhum cliente encontrado</div>
          )}
          {clientes.map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-[#f0f4f9] transition-colors"
              onClick={() => { onChange(c); setSearch(c.customerName); setOpen(false); }}
            >
              <p className="text-sm font-medium text-[#0A2540]">{c.customerName}</p>
              <p className="text-xs text-gray-500">NIF: {c.customerTaxID}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
