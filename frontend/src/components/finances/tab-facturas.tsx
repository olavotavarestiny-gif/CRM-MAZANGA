'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, TrendingUp, Clock } from 'lucide-react';
import { getFacturas, getFaturacaoDashboard } from '@/lib/api';

function fmtKz(n: number) {
  return n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
}

const CARD_COLORS: Record<string, { iconBg: string; border: string; text: string }> = {
  workspace: { iconBg: 'bg-[var(--workspace-primary-soft)]', border: 'border-[var(--workspace-primary-border)]', text: 'text-[var(--workspace-primary)]' },
  emerald: { iconBg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  amber: { iconBg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  slate: { iconBg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-700' },
};

function AgtBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    P:  { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    V:  { label: 'Válida',     className: 'bg-green-100 text-green-700 border-green-200' },
    I:  { label: 'Inválida',   className: 'bg-red-100 text-red-700 border-red-200' },
    A:  { label: 'Anulada',    className: 'bg-gray-100 text-gray-500 border-gray-200' },
    NA: { label: 'Não Fiscal', className: 'bg-amber-100 text-amber-700 border-amber-200' },
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
          <h2 className="text-base font-semibold text-[#2c2f31]">Facturas Emitidas</h2>
          {dash?.mockMode && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
              Modo MOCK — AGT simulada
            </span>
          )}
        </div>
        <Link href="/faturacao/nova">
          <Button className="gap-2">
            <Plus className="w-4 h-4" /> Nova Factura
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {dash && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Facturas (Mês)', value: dash.totalMes, icon: FileText, color: 'workspace' },
            { label: 'Receita (Mês)', value: fmtKz(dash.receitaMes), icon: TrendingUp, color: 'emerald' },
            { label: 'Pendentes AGT', value: dash.pendentesAGT, icon: Clock, color: 'amber' },
            { label: 'Total Facturas', value: dash.totalGeral, icon: FileText, color: 'slate' },
          ].map(({ label, value, icon: Icon, color }) => {
            const styles = CARD_COLORS[color] ?? CARD_COLORS.workspace;

            return (
              <div key={label} className={`rounded-2xl border bg-white p-4 shadow-sm ${styles.border}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${styles.iconBg}`}>
                    <Icon className="h-4 w-4 text-gray-500" />
                  </span>
                </div>
                <div className={`text-lg font-bold ${styles.text}`}>
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Pesquisar por número, cliente ou NIF..."
        isLoading={isLoading}
        hasActiveFilters={!!search || !!docType || !!docStatus}
        onClearFilters={() => { setSearch(''); setDocType(''); setDocStatus(''); setPage(1); }}
      >
        <Select value={docType || 'all'} onValueChange={v => { setDocType(v === 'all' ? '' : v); setPage(1); }}>
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
            <SelectItem value="PF">PF — Proforma</SelectItem>
          </SelectContent>
        </Select>
        <Select value={docStatus || 'all'} onValueChange={v => { setDocStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos estados</SelectItem>
            <SelectItem value="N">Normal</SelectItem>
            <SelectItem value="A">Anulada</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

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
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse border-b border-gray-100 bg-gray-50 last:border-0" />
            ))}
          </div>
        )}
        {!isLoading && facturas.length === 0 && (
          <EmptyState
            variant={search || docType || docStatus ? 'no-results' : 'empty'}
            icon={FileText}
            title={search || docType || docStatus ? 'Nenhuma factura encontrada' : 'Ainda não há facturas emitidas'}
            description={search || docType || docStatus ? 'Tenta ajustar ou limpar os filtros.' : 'Cria a primeira factura para começar a faturar.'}
            action={!search && !docType && !docStatus ? { label: 'Nova Factura', href: '/faturacao/nova' } : undefined}
            compact
          />
        )}
        {facturas.map(f => (
          <Link key={f.id} href={`/faturacao/${f.id}`}
            className={`grid grid-cols-12 px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors ${f.documentStatus === 'A' ? 'opacity-50' : ''}`}>
            <span className="col-span-2 text-[#2c2f31] font-mono text-sm">{f.documentNo}</span>
            <span className="col-span-1">
              <span className={`px-1.5 py-0.5 rounded text-xs border ${f.documentType === 'PF' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]'}`}>{f.documentType}</span>
            </span>
            <div className="col-span-3">
              <p className="text-[#2c2f31] text-sm truncate">{f.customerName}</p>
              <p className="text-gray-400 text-xs">{f.customerTaxID}</p>
            </div>
            <span className="col-span-2 text-gray-600 text-sm">{new Date(f.documentDate).toLocaleDateString('pt-PT')}</span>
            <span className="col-span-2 text-right text-[#2c2f31] font-mono text-sm">{fmtKz(f.grossTotal)}</span>
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
