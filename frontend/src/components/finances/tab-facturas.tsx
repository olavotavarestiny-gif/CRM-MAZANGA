'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, TrendingUp, Clock, Search } from 'lucide-react';
import { getFacturas, getFaturacaoDashboard } from '@/lib/api';

function fmtKz(n: number) {
  return n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
}

function AgtBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    P: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    V: { label: 'Válida', className: 'bg-green-100 text-green-700 border-green-200' },
    I: { label: 'Inválida', className: 'bg-red-100 text-red-700 border-red-200' },
    A: { label: 'Anulada', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  };
  const b = map[status] || map.P;
  return <span className={`px-1.5 py-0.5 rounded text-xs border ${b.className}`}>{b.label}</span>;
}

export function TabFacturas() {
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [docStatus, setDocStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data: dash } = useQuery({
    queryKey: ['faturacao-dashboard'],
    queryFn: getFaturacaoDashboard,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['facturas', search, docType, docStatus, page],
    queryFn: () => getFacturas({ search: search || undefined, documentType: docType || undefined, documentStatus: docStatus || undefined, page, limit: 20 }),
  });

  const facturas = data?.facturas ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-[#0A2540]">Facturas Emitidas</h2>
          {dash?.mockMode && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
              Modo MOCK — AGT simulada
            </span>
          )}
        </div>
        <Link href="/faturacao/nova">
          <Button className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 gap-2">
            <Plus className="w-4 h-4" /> Nova Factura
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {dash && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Facturas (Mês)', value: dash.totalMes, icon: FileText, color: 'border-l-purple-500' },
            { label: 'Receita (Mês)', value: fmtKz(dash.receitaMes), icon: TrendingUp, color: 'border-l-emerald-500' },
            { label: 'Pendentes AGT', value: dash.pendentesAGT, icon: Clock, color: 'border-l-amber-500' },
            { label: 'Total Facturas', value: dash.totalGeral, icon: FileText, color: 'border-l-indigo-500' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-xl bg-gray-50 border border-gray-200 border-l-4 ${s.color}`}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className="text-xl font-bold text-[#0A2540]">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Pesquisar por número, cliente ou NIF..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={docType} onValueChange={v => { setDocType(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="FT">FT — Factura</SelectItem>
            <SelectItem value="FR">FR — Fac/Recibo</SelectItem>
            <SelectItem value="ND">ND — N. Débito</SelectItem>
            <SelectItem value="NC">NC — N. Crédito</SelectItem>
            <SelectItem value="FA">FA — Simplificada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={docStatus} onValueChange={v => { setDocStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            <SelectItem value="N">Normal</SelectItem>
            <SelectItem value="A">Anulada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 text-xs text-gray-500 font-medium uppercase tracking-wide px-4 py-2 border-b border-gray-200">
          <span className="col-span-2">Número</span>
          <span className="col-span-1">Tipo</span>
          <span className="col-span-3">Cliente</span>
          <span className="col-span-2">Data</span>
          <span className="col-span-2 text-right">Total</span>
          <span className="col-span-2 text-right">Estado AGT</span>
        </div>
        {isLoading && (
          <div className="py-12 text-center text-gray-400">A carregar...</div>
        )}
        {!isLoading && facturas.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma factura encontrada</p>
            <Link href="/faturacao/nova" className="text-orange-500 hover:text-orange-600 text-sm mt-1 inline-block">
              Criar primeira factura →
            </Link>
          </div>
        )}
        {facturas.map(f => (
          <Link key={f.id} href={`/faturacao/${f.id}`}
            className={`grid grid-cols-12 px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors ${f.documentStatus === 'A' ? 'opacity-50' : ''}`}>
            <span className="col-span-2 text-[#0A2540] font-mono text-sm">{f.documentNo}</span>
            <span className="col-span-1">
              <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 border border-purple-200">{f.documentType}</span>
            </span>
            <div className="col-span-3">
              <p className="text-[#0A2540] text-sm truncate">{f.customerName}</p>
              <p className="text-gray-400 text-xs">{f.customerTaxID}</p>
            </div>
            <span className="col-span-2 text-gray-600 text-sm">{new Date(f.documentDate).toLocaleDateString('pt-PT')}</span>
            <span className="col-span-2 text-right text-[#0A2540] font-mono text-sm">{fmtKz(f.grossTotal)}</span>
            <span className="col-span-2 flex justify-end">
              {f.documentStatus === 'A' ? (
                <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-400 border border-gray-200 line-through">Anulada</span>
              ) : (
                <AgtBadge status={f.agtValidationStatus} />
              )}
            </span>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="flex items-center px-3 text-sm text-gray-500">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próximo</Button>
        </div>
      )}
    </div>
  );
}
