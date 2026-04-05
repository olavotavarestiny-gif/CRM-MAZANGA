'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  buildMonthlyFinancePeriod,
  getFinanceDashboard,
  getTransactions,
  deleteTransaction,
  markTransactionPaid,
  getClientProfitability,
  downloadTransactionsCSV,
  getCurrentUser,
} from '@/lib/api';
import { Transaction, ClientProfitability } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isComercio } from '@/lib/business-modes';
import TransactionForm from '@/components/finances/transaction-form';
import ClientProfitabilityModal from '@/components/finances/client-profitability-modal';
import { TrendingUp, TrendingDown, DollarSign, Percent, RefreshCw, Plus, Download, ChevronLeft, ChevronRight, Pencil, Trash2, BarChart2, ArrowDownUp } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';

function fmt(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '0 Kz';
  return new Intl.NumberFormat('pt-PT').format(Math.round(n)) + ' Kz';
}

const CARD_COLORS: Record<string, { iconBg: string; border: string; text: string }> = {
  emerald: { iconBg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  red:     { iconBg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700' },
  blue:    { iconBg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700' },
  purple:  { iconBg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700' },
  cyan:    { iconBg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-700' },
};

const now = new Date();

export default function FinancesPage() {
  const queryClient = useQueryClient();

  // Shared monthly period
  const [dashYear, setDashYear] = useState(now.getFullYear());
  const [dashMonth, setDashMonth] = useState(now.getMonth() + 1);
  const monthPeriod = buildMonthlyFinancePeriod(dashYear, dashMonth);

  // Transaction filters
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const filterCategory = '';
  const [search, setSearch] = useState('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | undefined>();
  const [profitabilityClient, setProfitabilityClient] = useState<ClientProfitability | null>(null);
  const [activeTab, setActiveTab] = useState<'transacoes' | 'rentabilidade'>('transacoes');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });

  const isComercioWorkspace = isComercio(currentUser?.workspaceMode);
  const title = isComercioWorkspace ? 'Finanças do Comércio' : 'Finanças';
  const subtitle = isComercioWorkspace
    ? 'Movimentos financeiros, despesas e rentabilidade operacional do negócio.'
    : 'Receitas, despesas e rentabilidade por cliente.';
  const primaryAccent = isComercioWorkspace ? '#F06A1A' : '#0A2540';
  const tabActiveClass = isComercioWorkspace
    ? 'bg-[#F06A1A] text-white shadow-sm'
    : 'bg-[#0A2540] text-white shadow-sm';
  const tabIdleClass = isComercioWorkspace
    ? 'text-[#6b7e9a] hover:bg-[#FDF2EA] hover:text-[#F06A1A]'
    : 'text-[#6b7e9a] hover:bg-slate-50 hover:text-[#0A2540]';
  const bannerClass = isComercioWorkspace
    ? 'rounded-2xl border border-[#F6D2BC] bg-[#FFF7F1] px-4 py-3 text-sm text-[#8A4313] shadow-sm'
    : 'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#6b7e9a] shadow-sm';

  const { data: dashboard } = useQuery({
    queryKey: ['finance-dashboard', dashYear, dashMonth],
    queryFn: () =>
      getFinanceDashboard({
        year: monthPeriod.year,
        month: monthPeriod.month,
      }),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', dashYear, dashMonth, page, filterType, filterStatus, filterCategory, search],
    queryFn: () =>
      getTransactions({
        page,
        limit: 50,
        type: filterType || undefined,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        dateFrom: monthPeriod.dateFrom,
        dateTo: monthPeriod.dateTo,
        search: search || undefined,
      }),
  });

  const { data: profitability = [] } = useQuery({
    queryKey: ['profitability'],
    queryFn: getClientProfitability,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: markTransactionPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['profitability'] });
    },
  });

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const activeMonthLabel = `${monthNames[dashMonth - 1]} ${dashYear}`;

  useEffect(() => {
    setPage(1);
  }, [dashYear, dashMonth]);

  const handlePrevMonth = () => {
    if (dashMonth === 1) { setDashMonth(12); setDashYear((y) => y - 1); }
    else setDashMonth((m) => m - 1);
  };
  const handleNextMonth = () => {
    if (dashMonth === 12) { setDashMonth(1); setDashYear((y) => y + 1); }
    else setDashMonth((m) => m + 1);
  };

  const handleEdit = (tx: Transaction) => {
    setEditTransaction(tx);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Eliminar esta transação?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditTransaction(undefined);
  };

  const marginColor = (pct: number) =>
    pct >= 50 ? 'text-emerald-600' : pct >= 20 ? 'text-yellow-600' : 'text-red-600';

  const TABS = [
    { id: 'transacoes',    label: 'Transações' },
    { id: 'rentabilidade', label: 'Rentabilidade' },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">{title}</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">{subtitle}</p>
        </div>
        {activeTab === 'transacoes' && (
          <Button
            onClick={() => { setEditTransaction(undefined); setFormOpen(true); }}
            className="gap-2"
            style={{ backgroundColor: primaryAccent, borderColor: primaryAccent }}
          >
            <Plus className="w-4 h-4" />
            Nova Transação
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? tabActiveClass
                : tabIdleClass
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={bannerClass}>
        {isComercioWorkspace ? 'A faturação documental e os documentos fiscais estão centralizados em ' : 'Faturas e documentos fiscais estão centralizados em '}
        <a href="/vendas" className="font-medium underline-offset-4 hover:underline" style={{ color: primaryAccent }}>
          /vendas
        </a>
        .
      </div>

      {/* Tab content */}
      {activeTab === 'rentabilidade' && (
        <div className="space-y-4 mt-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
            Rentabilidade por Cliente
          </h2>
          {profitability.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <EmptyState
                variant="empty"
                icon={BarChart2}
                title="Sem dados de rentabilidade"
                description="Regista transações associadas a clientes para ver a margem por cliente aqui."
                action={{ label: 'Nova Transação', onClick: () => { setEditTransaction(undefined); setFormOpen(true); setActiveTab('transacoes'); } }}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Cliente</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Receita</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Custos</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">Margem Líquida</th>
                      <th className="text-right py-3 px-4 text-gray-500 font-medium">%</th>
                      <th className="py-3 px-4 text-gray-500 font-medium text-center">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitability.map((p) => (
                      <tr key={p.clientId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-[#0A2540] font-medium">{p.clientName}</td>
                        <td className="py-3 px-4 text-right text-emerald-600">{fmt(p.totalRevenue)}</td>
                        <td className="py-3 px-4 text-right text-red-600">-{fmt(p.totalCosts)}</td>
                        <td className={`py-3 px-4 text-right font-medium ${marginColor(p.marginPercent)}`}>
                          {fmt(p.netMargin)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${marginColor(p.marginPercent)}`}>
                          {p.marginPercent.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setProfitabilityClient(p)}
                            className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <ClientProfitabilityModal
            client={profitabilityClient}
            onClose={() => setProfitabilityClient(null)}
          />
        </div>
      )}
      {activeTab === 'transacoes' && <div className="space-y-8">

      {/* ── SECÇÃO 1: Dashboard ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Painel</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-sm text-[#0A2540] font-medium min-w-[80px] text-center">
              {monthNames[dashMonth - 1]} {dashYear}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Receita', value: dashboard?.revenue || 0, color: 'emerald', icon: TrendingUp },
            { label: 'Despesas', value: dashboard?.expenses || 0, color: 'red', icon: TrendingDown },
            { label: 'Lucro', value: dashboard?.profit || 0, color: 'blue', icon: DollarSign },
            { label: 'Margem', value: dashboard?.marginPercent || 0, color: 'purple', icon: Percent, isPercent: true },
            { label: 'Receita Mensal', value: (dashboard?.receitaMensal ?? dashboard?.mrr) || 0, color: 'cyan', icon: RefreshCw },
          ].map(({ label, value, color, icon: Icon, isPercent }) => {
            const c = CARD_COLORS[color] ?? CARD_COLORS.emerald;
            return (
              <div key={label} className={`rounded-2xl border bg-white p-4 shadow-sm ${c.border}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.iconBg}`}>
                    <Icon className="w-4 h-4 text-gray-500" />
                  </span>
                </div>
                <div className={`text-lg font-bold ${c.text}`}>
                  {isPercent ? `${(value as number).toFixed(1)}%` : fmt(value)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── SECÇÃO 2: Transações ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Transações</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTransactionsCSV({
              type: filterType || undefined,
              status: filterStatus || undefined,
              dateFrom: monthPeriod.dateFrom,
              dateTo: monthPeriod.dateTo,
            })}
            className="border-gray-200 text-gray-600 hover:bg-gray-50 gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filtros */}
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Pesquisar transações..."
          isLoading={txLoading}
          hasActiveFilters={!!search || !!filterType || !!filterStatus}
          onClearFilters={() => { setSearch(''); setFilterType(''); setFilterStatus(''); setPage(1); }}
          className="mb-4"
        >
          <Select value={filterType || 'all'} onValueChange={(v) => { setFilterType(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus || 'all'} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
        <div className="mb-4 flex items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          A mostrar movimentos de {activeMonthLabel}
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Data</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Cliente</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Tipo</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Categoria</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-medium">Valor</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Próximo</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                  <th className="py-3 px-4 text-gray-500 font-medium text-center">Acções</th>
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse border-b border-slate-100 bg-slate-50" />
                      ))}
                    </td>
                  </tr>
                ) : (txData?.data || []).length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        variant={search || filterType || filterStatus ? 'no-results' : 'empty'}
                        icon={ArrowDownUp}
                        title={search || filterType || filterStatus ? 'Sem resultados' : `Sem movimentos em ${activeMonthLabel}`}
                        description={search || filterType || filterStatus ? 'Tenta ajustar ou limpar os filtros.' : 'Regista a primeira receita ou despesa deste período.'}
                        action={!search && !filterType && !filterStatus ? { label: 'Nova Transação', onClick: () => { setEditTransaction(undefined); setFormOpen(true); } } : undefined}
                        compact
                      />
                    </td>
                  </tr>
                ) : (
                  (txData?.data || []).map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(tx.date).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {tx.clientName || <span className="text-gray-500">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          tx.type === 'entrada'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.type === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {tx.category}
                        {tx.subcategory && (
                          <span className="text-gray-400 text-xs ml-1">/ {tx.subcategory}</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        tx.type === 'entrada' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {tx.type === 'entrada' ? '+' : '-'}{fmt(tx.amountKz)}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {tx.nextPaymentDate
                          ? new Date(tx.nextPaymentDate).toLocaleDateString('pt-PT')
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          tx.status === 'pago'
                            ? 'bg-emerald-50 text-emerald-700'
                            : tx.status === 'pendente'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {tx.status === 'pago' ? 'Pago' : tx.status === 'pendente' ? 'Pendente' : 'Atrasado'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {tx.revenueType === 'recorrente' && tx.nextPaymentDate && (
                            <button
                              onClick={() => markPaidMutation.mutate(tx.id)}
                              disabled={markPaidMutation.isPending}
                              title="Marcar Pago"
                              className="text-xs px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded transition-colors"
                            >
                              Marcar Pago
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(tx)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-500 hover:text-gray-900"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1 hover:bg-red-500/10 rounded transition-colors text-gray-500 hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {txData && txData.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-gray-400">
                {txData.total} transações · página {txData.page} de {txData.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(txData.totalPages, p + 1))}
                  disabled={page === txData.totalPages}
                  className="border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Seguinte
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modals */}
      <TransactionForm
        open={formOpen}
        onClose={handleFormClose}
        transaction={editTransaction}
      />
      </div>}
    </div>
  );
}
