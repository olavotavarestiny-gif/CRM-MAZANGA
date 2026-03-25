'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFinanceDashboard,
  getTransactions,
  deleteTransaction,
  markTransactionPaid,
  getClientProfitability,
  downloadTransactionsCSV,
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
import TransactionForm from '@/components/finances/transaction-form';
import ClientProfitabilityModal from '@/components/finances/client-profitability-modal';
import { TrendingUp, TrendingDown, DollarSign, Percent, RefreshCw, Plus, Download, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';

function fmt(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '0 Kz';
  return new Intl.NumberFormat('pt-PT').format(Math.round(n)) + ' Kz';
}

const CARD_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700' },
  red:     { bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-700' },
  blue:    { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-700' },
  purple:  { bg: 'bg-violet-50',   border: 'border-violet-200',  text: 'text-violet-700' },
  cyan:    { bg: 'bg-sky-50',      border: 'border-sky-200',     text: 'text-sky-700' },
};

const now = new Date();

export default function FinancesPage() {
  const queryClient = useQueryClient();

  // Dashboard filter
  const [dashYear, setDashYear] = useState(now.getFullYear());
  const [dashMonth, setDashMonth] = useState(now.getMonth() + 1);

  // Transaction filters
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const filterCategory = '';
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | undefined>();
  const [profitabilityClient, setProfitabilityClient] = useState<ClientProfitability | null>(null);
  const [activeTab, setActiveTab] = useState<'transacoes' | 'rentabilidade'>('transacoes');

  const { data: dashboard } = useQuery({
    queryKey: ['finance-dashboard', dashYear, dashMonth],
    queryFn: () =>
      getFinanceDashboard({
        dateFrom: `${dashYear}-${String(dashMonth).padStart(2, '0')}-01`,
        dateTo: new Date(dashYear, dashMonth, 0).toISOString().slice(0, 10),
      }),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', page, filterType, filterStatus, filterCategory, filterDateFrom, filterDateTo, search],
    queryFn: () =>
      getTransactions({
        page,
        limit: 50,
        type: filterType || undefined,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">Finanças</h1>
          <p className="text-gray-500 text-sm mt-1">Receitas, despesas e rentabilidade por cliente</p>
        </div>
        {activeTab === 'transacoes' && (
          <Button
            onClick={() => { setEditTransaction(undefined); setFormOpen(true); }}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Transação
          </Button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#0A2540] text-[#0A2540]'
                : 'border-transparent text-gray-500 hover:text-[#0A2540]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Link to vendas */}
      <p className="text-xs text-gray-400 mt-2">
        Faturas e documentos fiscais →{' '}
        <a href="/vendas" className="text-[#0A2540] underline hover:text-orange-500 transition-colors">
          /vendas
        </a>
      </p>

      {/* Tab content */}
      {activeTab === 'rentabilidade' && (
        <div className="space-y-4 mt-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
            Rentabilidade por Cliente
          </h2>
          {profitability.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl py-12 text-center text-gray-400">
              Sem dados de rentabilidade disponíveis.
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
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
            { label: 'MRR', value: dashboard?.mrr || 0, color: 'cyan', icon: RefreshCw },
          ].map(({ label, value, color, icon: Icon, isPercent }) => {
            const c = CARD_COLORS[color] ?? CARD_COLORS.emerald;
            return (
              <div
                key={label}
                className={`${c.bg} border ${c.border} rounded-xl p-4 backdrop-blur-sm`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{label}</span>
                  <Icon className="w-4 h-4 text-gray-400" />
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
            onClick={() => downloadTransactionsCSV({ type: filterType || undefined, dateFrom: filterDateFrom || undefined, dateTo: filterDateTo || undefined })}
            className="border-gray-200 text-gray-600 hover:bg-gray-50 gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="col-span-2"
          />
          <Select value={filterType} onValueChange={(v) => { setFilterType(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
          />
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
          />
        </div>

        {/* Tabela */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
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
                    <td colSpan={8} className="py-12 text-center text-gray-400">A carregar...</td>
                  </tr>
                ) : (txData?.data || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      Nenhuma transação encontrada.
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
