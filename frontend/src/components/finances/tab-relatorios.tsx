'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, BarChart2, FileText, TrendingUp, RefreshCw } from 'lucide-react';
import { getIvaReport, getVendasReport, getIvaExportUrl, getVendasExportUrl } from '@/lib/api';

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmt(n: number) {
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' Kz';
}

function RateRow({ label, base, iva, count }: { label: string; base: number; iva: number; count: number }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-[#0A2540]">{label}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmt(base)}</td>
      <td className="px-4 py-3 text-sm text-right font-semibold text-[#0049e6] tabular-nums">{fmt(iva)}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-500 tabular-nums">{fmt(base + iva)}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-400 tabular-nums">{count}</td>
    </tr>
  );
}

export function TabRelatorios() {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const [activeReport, setActiveReport] = useState<'iva' | 'vendas'>('iva');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(currentMonth);

  const periodo = `${year}-${month}`;
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const ivaQuery = useQuery({
    queryKey: ['relatorio-iva', periodo],
    queryFn: () => getIvaReport(periodo),
    enabled: activeReport === 'iva',
  });

  const vendasQuery = useQuery({
    queryKey: ['relatorio-vendas', year],
    queryFn: () => getVendasReport(Number(year)),
    enabled: activeReport === 'vendas',
  });

  const handleExport = async (type: 'iva' | 'vendas') => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
    const url = type === 'iva'
      ? `${getIvaExportUrl(periodo)}&token=${encodeURIComponent(token)}`
      : `${getVendasExportUrl(Number(year))}&token=${encodeURIComponent(token)}`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#0A2540]">Relatórios Fiscais</h2>
      </div>

      {/* Report type toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveReport('iva')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeReport === 'iva' ? 'bg-white text-[#0A2540] shadow-sm' : 'text-gray-500 hover:text-[#0A2540]'
          }`}
        >
          <FileText className="w-4 h-4" /> Relatório IVA
        </button>
        <button
          onClick={() => setActiveReport('vendas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeReport === 'vendas' ? 'bg-white text-[#0A2540] shadow-sm' : 'text-gray-500 hover:text-[#0A2540]'
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Volume de Vendas
        </button>
      </div>

      {/* ── IVA REPORT ── */}
      {activeReport === 'iva' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-1">Mês</p>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={m}>{MONTH_NAMES[i]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Ano</p>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => ivaQuery.refetch()}
              disabled={ivaQuery.isFetching}
              className="border-gray-200"
            >
              {ivaQuery.isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('iva')}
              className="border-[#0049e6] text-[#0049e6] hover:bg-blue-50 gap-2"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>

          {ivaQuery.isLoading && <div className="py-12 text-center text-gray-400">A carregar relatório...</div>}
          {ivaQuery.isError && <div className="py-6 text-center text-red-500 text-sm">Erro ao carregar relatório.</div>}

          {ivaQuery.data && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Base Tributável</p>
                  <p className="text-2xl font-bold text-[#0A2540] mt-1 tabular-nums">{fmt(ivaQuery.data.totalBase)}</p>
                </div>
                <div className="p-4 rounded-xl border border-[#0049e6]/20 bg-blue-50">
                  <p className="text-xs text-[#0049e6] uppercase tracking-wide font-medium">IVA Liquidado</p>
                  <p className="text-2xl font-bold text-[#0049e6] mt-1 tabular-nums">{fmt(ivaQuery.data.totalIva)}</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total c/ IVA</p>
                  <p className="text-2xl font-bold text-[#0A2540] mt-1 tabular-nums">{fmt(ivaQuery.data.totalGross)}</p>
                </div>
              </div>

              {/* By rate table */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">Detalhe por Taxa de IVA</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                      <th className="px-4 py-2 text-left">Taxa</th>
                      <th className="px-4 py-2 text-right">Base (s/IVA)</th>
                      <th className="px-4 py-2 text-right">IVA</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Linhas</th>
                    </tr>
                  </thead>
                  <tbody>
                    <RateRow label="14% — Normal (NOR)" {...ivaQuery.data.byRate.rate14} />
                    <RateRow label="5% — Reduzido (RED)"  {...ivaQuery.data.byRate.rate5} />
                    <RateRow label="0% — Isento (ISE)"    {...ivaQuery.data.byRate.rate0} />
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-[#0A2540]">Total</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">{fmt(ivaQuery.data.totalBase)}</td>
                      <td className="px-4 py-3 text-sm text-right text-[#0049e6] tabular-nums">{fmt(ivaQuery.data.totalIva)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">{fmt(ivaQuery.data.totalGross)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{ivaQuery.data.facturas.length}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Facturas list */}
              {ivaQuery.data.facturas.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">Documentos do Período ({ivaQuery.data.facturas.length})</h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {ivaQuery.data.facturas.map((f) => (
                      <div key={f.documentNo} className="grid grid-cols-12 px-4 py-2.5 text-sm items-center hover:bg-gray-50">
                        <span className="col-span-3 font-mono text-gray-500">{f.documentNo}</span>
                        <span className="col-span-2 text-gray-400 text-xs">{new Date(f.documentDate).toLocaleDateString('pt-PT')}</span>
                        <span className="col-span-4 text-[#0A2540] truncate">{f.customerName}</span>
                        <span className="col-span-1 text-right text-gray-500 tabular-nums text-xs">{fmt(f.netTotal)}</span>
                        <span className="col-span-1 text-right text-[#0049e6] tabular-nums text-xs font-medium">{fmt(f.taxPayable)}</span>
                        <span className="col-span-1 text-right text-gray-700 tabular-nums text-xs font-semibold">{fmt(f.grossTotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── VENDAS REPORT ── */}
      {activeReport === 'vendas' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <p className="text-xs text-gray-500 mb-1">Ano</p>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => vendasQuery.refetch()}
              disabled={vendasQuery.isFetching}
              className="border-gray-200"
            >
              {vendasQuery.isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('vendas')}
              className="border-[#0049e6] text-[#0049e6] hover:bg-blue-50 gap-2"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          </div>

          {vendasQuery.isLoading && <div className="py-12 text-center text-gray-400">A carregar relatório...</div>}
          {vendasQuery.isError && <div className="py-6 text-center text-red-500 text-sm">Erro ao carregar relatório.</div>}

          {vendasQuery.data && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Faturado</p>
                  <p className="text-2xl font-bold text-[#0A2540] mt-1 tabular-nums">{fmt(vendasQuery.data.totals.grossTotal)}</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Base s/IVA</p>
                  <p className="text-2xl font-bold text-[#0A2540] mt-1 tabular-nums">{fmt(vendasQuery.data.totals.netTotal)}</p>
                </div>
                <div className="p-4 rounded-xl border border-[#0049e6]/20 bg-blue-50">
                  <p className="text-xs text-[#0049e6] uppercase tracking-wide font-medium">IVA Total</p>
                  <p className="text-2xl font-bold text-[#0049e6] mt-1 tabular-nums">{fmt(vendasQuery.data.totals.taxPayable)}</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Nº Documentos</p>
                  <p className="text-2xl font-bold text-[#0A2540] mt-1">{vendasQuery.data.totals.count}</p>
                </div>
              </div>

              {/* Monthly table */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">Volume Mensal {year}</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                      <th className="px-4 py-2 text-left">Mês</th>
                      <th className="px-4 py-2 text-right">Docs.</th>
                      <th className="px-4 py-2 text-right">Base (s/IVA)</th>
                      <th className="px-4 py-2 text-right">IVA</th>
                      <th className="px-4 py-2 text-right">Total c/IVA</th>
                      <th className="px-4 py-2 text-right">Barra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasQuery.data.months.map((m) => {
                      const maxGross = Math.max(...vendasQuery.data!.months.map(x => x.grossTotal), 1);
                      const pct = (m.grossTotal / maxGross) * 100;
                      return (
                        <tr key={m.month} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${m.count === 0 ? 'opacity-40' : ''}`}>
                          <td className="px-4 py-3 text-sm font-medium text-[#0A2540]">{m.label}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500 tabular-nums">{m.count}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600 tabular-nums">{fmt(m.netTotal)}</td>
                          <td className="px-4 py-3 text-sm text-right text-[#0049e6] tabular-nums">{fmt(m.taxPayable)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-[#0A2540] tabular-nums">{fmt(m.grossTotal)}</td>
                          <td className="px-4 py-3 w-24">
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-[#0049e6] transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-[#0A2540]">Total {year}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{vendasQuery.data.totals.count}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 tabular-nums">{fmt(vendasQuery.data.totals.netTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-[#0049e6] tabular-nums">{fmt(vendasQuery.data.totals.taxPayable)}</td>
                      <td className="px-4 py-3 text-sm text-right text-[#0A2540] tabular-nums">{fmt(vendasQuery.data.totals.grossTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
