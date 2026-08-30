'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Archive, ArrowRight, Banknote, Bike, CalendarDays, CheckCircle2, ClipboardList, Download, LockKeyhole, PackageCheck, Printer, ReceiptText, Scale, Store, WalletCards, X, XCircle } from 'lucide-react';
import { createFoodMonthlyClose, exportFoodMonthlyCloseCsv, exportFoodMonthlyClosePdf, getFoodContext, getFoodMonthCloseReadiness, getFoodMonthlyCloses, getFoodOperationalReport, getFoodSettings, previewFoodMonthlyClosePrint, recloseFoodMonthlyClose, reopenFoodMonthlyClose } from '@/lib/api';
import type { FoodMonthlyClose, FoodOperationalReportSummary } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { FoodConfirmDialog } from '@/components/food/food-confirm-dialog';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultPeriod() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to), branchId: '' };
}

const COLLECTION_LABELS: Record<string, string> = {
  pending_collection: 'Por cobrar', with_courier: 'Com entregador', handed_to_cashier: 'Entregue ao caixa',
  not_received: 'Não recebido', discrepancy: 'Divergência', reconciled: 'Reconciliado', returned: 'Devolvido',
};

function formatMoney(value: number, currency = 'AOA') {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function recordSummary(record: Record<string, unknown>) {
  const subject = record.orderNumber ? `Pedido #${String(record.orderNumber).padStart(4, '0')}` : record.personName || record.name || record.reference || record.id;
  const context = [record.branchName, record.state || record.approvalStatus].filter(Boolean).join(' · ');
  return `${String(subject || 'Registo')}${context ? ` · ${context}` : ''}`;
}

function Trend({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-xs font-semibold text-slate-400">Sem base anterior</span>;
  const tone = value > 0 ? 'text-emerald-700' : value < 0 ? 'text-red-700' : 'text-slate-500';
  return <span className={`text-xs font-bold ${tone}`}>{value > 0 ? '+' : ''}{value}% vs. período anterior</span>;
}

function Metric({ label, value, detail, trend, icon: Icon, tone }: { label: string; value: string; detail: string; trend?: number | null; icon: typeof Store; tone: string }) {
  return <Card className="border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p>{trend !== undefined ? <div className="mt-2"><Trend value={trend} /></div> : null}</div><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div></div></Card>;
}

export default function FoodOperationalReportsPage() {
  const queryClient = useQueryClient();
  const initial = useMemo(defaultPeriod, []);
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [closeMonth, setCloseMonth] = useState(initial.to.slice(0, 7));
  const [confirmClose, setConfirmClose] = useState(false);
  const [reopening, setReopening] = useState<FoodMonthlyClose | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reclosing, setReclosing] = useState<FoodMonthlyClose | null>(null);
  const [recloseReason, setRecloseReason] = useState('');
  const [printClose, setPrintClose] = useState<FoodMonthlyClose | null>(null);
  const [printRevisionId, setPrintRevisionId] = useState<string | undefined>();
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });
  const reportQuery = useQuery({
    queryKey: ['food-operational-report', filters],
    queryFn: () => getFoodOperationalReport({ from: filters.from, to: filters.to, branchId: filters.branchId || undefined }),
  });
  const readinessQuery = useQuery({
    queryKey: ['food-month-close-readiness', closeMonth, filters.branchId],
    queryFn: () => getFoodMonthCloseReadiness({ month: closeMonth, branchId: filters.branchId || undefined }),
    enabled: Boolean(closeMonth),
  });
  const closesQuery = useQuery({ queryKey: ['food-monthly-closes', filters.branchId], queryFn: () => getFoodMonthlyCloses(filters.branchId || undefined) });
  const closeMutation = useMutation({
    mutationFn: () => createFoodMonthlyClose({ month: closeMonth, branchId: filters.branchId || undefined }),
    onSuccess: async () => {
      setConfirmClose(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['food-monthly-closes'] }),
        queryClient.invalidateQueries({ queryKey: ['food-month-close-readiness'] }),
      ]);
    },
  });
  const reopenMutation = useMutation({
    mutationFn: () => reopenFoodMonthlyClose(reopening!.id, { version: reopening!.version, reason: reopenReason }),
    onSuccess: async () => {
      setReopening(null);
      setReopenReason('');
      await queryClient.invalidateQueries({ queryKey: ['food-monthly-closes'] });
    },
  });
  const recloseMutation = useMutation({
    mutationFn: () => recloseFoodMonthlyClose(reclosing!.id, { version: reclosing!.version, reason: recloseReason }),
    onSuccess: async () => {
      setReclosing(null);
      setRecloseReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['food-monthly-closes'] }),
        queryClient.invalidateQueries({ queryKey: ['food-month-close-readiness'] }),
      ]);
    },
  });
  const exportMutation = useMutation({
    mutationFn: ({ closeId, revisionId, format }: { closeId: string; revisionId?: string; format: 'csv' | 'pdf' }) => format === 'pdf' ? exportFoodMonthlyClosePdf(closeId, revisionId) : exportFoodMonthlyCloseCsv(closeId, revisionId),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  const printMutation = useMutation({
    mutationFn: ({ closeId, revisionId }: { closeId: string; revisionId?: string }) => previewFoodMonthlyClosePrint(closeId, revisionId),
    onSuccess: (blob) => setPrintUrl(URL.createObjectURL(blob)),
  });
  useEffect(() => () => {
    if (printUrl) URL.revokeObjectURL(printUrl);
  }, [printUrl]);
  const openPrintPreview = (close: FoodMonthlyClose, revisionId?: string) => {
    setPrintClose(close);
    setPrintRevisionId(revisionId);
    setPrintUrl(null);
    printMutation.reset();
    printMutation.mutate({ closeId: close.id, revisionId });
  };
  const closePrintPreview = () => {
    setPrintClose(null);
    setPrintRevisionId(undefined);
    setPrintUrl(null);
  };
  const error = reportQuery.error || readinessQuery.error || closesQuery.error || contextQuery.error;
  if (error) return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível gerar o relatório" message={getApiErrorMessage(error)} onRetry={() => Promise.all([reportQuery.refetch(), contextQuery.refetch()])} /></div>;
  const report = reportQuery.data;
  const summary = report?.summary;
  const currency = settingsQuery.data?.currency || 'AOA';
  const branches = contextQuery.data?.branches ?? [];
  const canClose = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('reports.close') || false;
  const canReopen = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('reports.reopen') || false;
  const needsExplicitBranch = contextQuery.data?.branchIds !== null && !filters.branchId;
  const existingClose = closesQuery.data?.find((item) => item.month.slice(0, 7) === closeMonth && item.scopeKey === (filters.branchId || 'all'));
  const collectionTotal = report?.pending.collections
    .filter((item) => ['with_courier', 'handed_to_cashier', 'discrepancy'].includes(item.state))
    .reduce((sum, item) => sum + Number(item.actualAmount ?? item.expectedAmount), 0) ?? 0;
  const comparison = report?.comparison || {};
  const summaryOrZero: FoodOperationalReportSummary = summary || { orders: 0, cancelledOrders: 0, cancellationRate: 0, orderValue: 0, received: 0, reconciled: 0, heldByCouriers: 0, outstanding: 0, averageTicket: 0, discounts: 0, delivered: 0, failedDeliveries: 0, deliverySuccessRate: 0, purchasesReceived: 0, cashDifference: 0 };

  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
    <FoodPageHeader eyebrow="Gestão Food" title="Histórico e reconciliação" description="Indicadores derivados dos pedidos, pagamentos, Caixas, entregas, compras e stock." />

    <section className="flex flex-col gap-3 border-y border-slate-200 bg-white px-4 py-4 md:flex-row md:items-end">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3"><label className="text-xs font-bold uppercase text-slate-500">De<Input className="mt-1.5" type="date" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} /></label><label className="text-xs font-bold uppercase text-slate-500">Até<Input className="mt-1.5" type="date" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} /></label><label className="text-xs font-bold uppercase text-slate-500">Unidade<select className="mt-1.5 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800" value={draft.branchId} onChange={(event) => setDraft((current) => ({ ...current, branchId: event.target.value }))}><option value="">Todas as autorizadas</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
      <Button disabled={!draft.from || !draft.to || draft.from > draft.to || reportQuery.isFetching} onClick={() => setFilters(draft)}><CalendarDays className="mr-2 h-4 w-4" />Aplicar período</Button>
    </section>

    {reportQuery.isLoading ? <div className="h-80 animate-pulse rounded-lg bg-white" /> : <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pedidos" value={String(summaryOrZero.orders)} detail={`${summaryOrZero.cancelledOrders} cancelados · ${summaryOrZero.cancellationRate}%`} trend={comparison.orders} icon={ClipboardList} tone="bg-blue-50 text-blue-700" />
        <Metric label="Valor dos pedidos" value={formatMoney(summaryOrZero.orderValue, currency)} detail={`${formatMoney(summaryOrZero.discounts, currency)} em descontos`} trend={comparison.orderValue} icon={ReceiptText} tone="bg-cyan-50 text-cyan-700" />
        <Metric label="Recebido" value={formatMoney(summaryOrZero.received, currency)} detail={`${formatMoney(summaryOrZero.outstanding, currency)} ainda por receber`} trend={comparison.received} icon={Banknote} tone="bg-emerald-50 text-emerald-700" />
        <Metric label="Ticket médio" value={formatMoney(summaryOrZero.averageTicket, currency)} detail={`${summaryOrZero.delivered} entregas concluídas`} trend={comparison.averageTicket} icon={PackageCheck} tone="bg-amber-50 text-amber-700" />
      </div>

      <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Reconciliação financeira</h2><p className="text-sm text-slate-500">Receber do cliente e entrar no Caixa são eventos diferentes.</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase text-emerald-700">Reconciliado</p><p className="mt-2 text-xl font-black text-emerald-950">{formatMoney(summaryOrZero.reconciled, currency)}</p></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase text-amber-700">Com entregadores</p><p className="mt-2 text-xl font-black text-amber-950">{formatMoney(collectionTotal, currency)}</p></div><div className="rounded-lg border border-red-200 bg-red-50 p-4"><p className="text-xs font-bold uppercase text-red-700">Diferenças de Caixa</p><p className="mt-2 text-xl font-black text-red-950">{formatMoney(summaryOrZero.cashDifference, currency)}</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-600">Caixas abertos</p><p className="mt-2 text-xl font-black text-slate-950">{report?.pending.openCashSessions ?? 0}</p></div></div></section>

      <section><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-black text-slate-950">Pré-validação do fecho</h2><p className="text-sm text-slate-500">Corrija todos os bloqueios antes de criar o snapshot mensal.</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="text-xs font-bold uppercase text-slate-500">Mês<Input className="mt-1.5 w-full sm:w-44" type="month" max={isoDate(new Date()).slice(0, 7)} value={closeMonth} onChange={(event) => setCloseMonth(event.target.value)} /></label>{canClose ? existingClose?.status === 'reopened' ? <Button disabled={!readinessQuery.data?.ready || needsExplicitBranch || recloseMutation.isPending} onClick={() => { setReclosing(existingClose); setRecloseReason(''); }}><LockKeyhole className="mr-2 h-4 w-4" />Fechar novamente</Button> : <Button disabled={!readinessQuery.data?.ready || Boolean(existingClose) || needsExplicitBranch || closeMutation.isPending} onClick={() => setConfirmClose(true)}><LockKeyhole className="mr-2 h-4 w-4" />{existingClose ? 'Mês fechado' : 'Fechar mês'}</Button> : null}</div></div>{needsExplicitBranch && canClose ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Selecione uma unidade no filtro superior para criar o fecho.</p> : null}{closeMutation.isError || recloseMutation.isError ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(closeMutation.error || recloseMutation.error)}</p> : null}{readinessQuery.isLoading ? <div className="h-40 animate-pulse rounded-lg bg-white" /> : <><div className={`mb-4 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${readinessQuery.data?.ready ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><div className="flex items-center gap-3">{readinessQuery.data?.ready ? <CheckCircle2 className="h-7 w-7 text-emerald-700" /> : <XCircle className="h-7 w-7 text-red-700" />}<div><p className={`font-black ${readinessQuery.data?.ready ? 'text-emerald-950' : 'text-red-950'}`}>{readinessQuery.data?.ready ? 'Mês pronto para fechar' : 'Fecho bloqueado'}</p><p className={`text-sm ${readinessQuery.data?.ready ? 'text-emerald-800' : 'text-red-800'}`}>{readinessQuery.data?.ready ? `${readinessQuery.data.totals.warningRecords} avisos para revisão` : `${readinessQuery.data?.totals.blockingRecords || 0} registos exigem correcção`}</p></div></div><Badge variant={readinessQuery.data?.ready ? 'success' : 'destructive'}>{readinessQuery.data?.totals.blockedChecks || 0} bloqueios</Badge></div><div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{readinessQuery.data?.checks.map((item) => { const StatusIcon = item.status === 'ok' ? CheckCircle2 : item.status === 'warning' ? AlertCircle : XCircle; return <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${item.status === 'ok' ? 'text-emerald-600' : item.status === 'warning' ? 'text-amber-600' : 'text-red-600'}`} /><div className="min-w-0"><p className="font-bold text-slate-950">{item.label}</p><p className="mt-1 text-xs text-slate-500">{item.count === 0 ? 'Sem pendências' : `${item.count} registo${item.count === 1 ? '' : 's'}${item.amount ? ` · ${formatMoney(item.amount, currency)}` : ''}`}</p></div></div><Badge variant={item.status === 'ok' ? 'success' : item.status === 'warning' ? 'secondary' : 'destructive'}>{item.status === 'ok' ? 'OK' : item.status === 'warning' ? 'Aviso' : 'Bloqueia'}</Badge></div>{item.records.length ? <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">{item.records.slice(0, 3).map((record, index) => <p key={`${item.key}-${index}`} className="truncate text-xs text-slate-600">{recordSummary(record)}</p>)}</div> : null}{item.count > 0 && item.actionHref ? <Button asChild size="sm" variant="outline" className="mt-3"><Link href={item.actionHref}>Corrigir origem<ArrowRight className="ml-2 h-4 w-4" /></Link></Button> : null}</div>; })}</div></>}</section>

      <section>
        <div className="mb-3"><h2 className="text-lg font-black text-slate-950">Fechos preservados</h2><p className="text-sm text-slate-500">O original e cada revisão permanecem disponíveis separadamente.</p></div>
        {exportMutation.isError ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(exportMutation.error)}</p> : null}
        {closesQuery.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-white" /> : !closesQuery.data?.length ? <FoodEmptyState icon={Archive} title="Ainda não há fechos" description="O primeiro snapshot aparecerá aqui quando todas as pendências forem resolvidas." /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Mês</th><th className="px-4 py-3">Âmbito</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Pedidos</th><th className="px-4 py-3 text-right">Reconciliado</th><th className="px-4 py-3">Snapshot actual</th><th className="px-4 py-3 text-right">Acções</th></tr></thead><tbody className="divide-y divide-slate-100">{closesQuery.data.map((item) => {
          const latest = item.revisions[item.revisions.length - 1];
          const snapshot = latest?.snapshot || item.snapshot;
          const closedAt = latest?.closedAt || item.closedAt;
          return <tr key={item.id}><td className="px-4 py-3 font-black text-slate-950">{item.month.slice(0, 7)}</td><td className="px-4 py-3 text-slate-600">{item.branch?.name || 'Organização'}</td><td className="px-4 py-3"><Badge variant={item.status === 'closed' ? 'success' : 'secondary'}>{item.status === 'closed' ? 'Fechado' : 'Reaberto'}</Badge>{item.reopenReason && item.status === 'reopened' ? <p className="mt-1 max-w-xs text-xs text-amber-700">{item.reopenReason}</p> : null}</td><td className="px-4 py-3 text-right text-slate-700">{snapshot.summary.orders}</td><td className="px-4 py-3 text-right font-bold text-emerald-700">{formatMoney(snapshot.summary.reconciled, currency)}</td><td className="px-4 py-3 text-slate-500"><p>{latest ? `Revisão ${latest.revisionNumber}` : 'Original'}</p><p className="text-xs">{new Date(closedAt).toLocaleString('pt-AO')}</p>{latest?.reason ? <p className="mt-1 max-w-xs text-xs text-slate-500">{latest.reason}</p> : null}</td><td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-1"><Button size="sm" variant="ghost" title={`Pré-visualizar e imprimir ${latest ? `revisão ${latest.revisionNumber}` : 'original'}`} disabled={printMutation.isPending} onClick={() => openPrintPreview(item, latest?.id)}><Printer className="mr-1 h-4 w-4" />Imprimir</Button><Button size="sm" variant="ghost" title={`Descarregar ${latest ? `revisão ${latest.revisionNumber}` : 'original'} em PDF`} disabled={exportMutation.isPending} onClick={() => exportMutation.mutate({ closeId: item.id, revisionId: latest?.id, format: 'pdf' })}><Download className="mr-1 h-4 w-4" />PDF</Button><Button size="sm" variant="ghost" title={`Descarregar ${latest ? `revisão ${latest.revisionNumber}` : 'original'} em CSV`} disabled={exportMutation.isPending} onClick={() => exportMutation.mutate({ closeId: item.id, revisionId: latest?.id, format: 'csv' })}>CSV</Button>{latest ? <><Button size="sm" variant="ghost" title="Descarregar snapshot original em PDF" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate({ closeId: item.id, format: 'pdf' })}>PDF original</Button><Button size="sm" variant="ghost" title="Descarregar snapshot original em CSV" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate({ closeId: item.id, format: 'csv' })}>CSV original</Button></> : null}{canReopen && item.status === 'closed' ? <Button size="sm" variant="outline" onClick={() => { setReopening(item); setReopenReason(''); }}>Reabrir</Button> : null}</div></td></tr>;
        })}</tbody></table></div></div>}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Por método</h2><p className="text-sm text-slate-500">Total recebido e parcela já conciliada.</p></div>{!report?.byMethod.length ? <FoodEmptyState icon={WalletCards} title="Sem pagamentos no período" description="Os métodos utilizados aparecerão aqui." /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Método</th><th className="px-4 py-3 text-right">Operações</th><th className="px-4 py-3 text-right">Recebido</th><th className="px-4 py-3 text-right">Conciliado</th></tr></thead><tbody className="divide-y divide-slate-100">{report.byMethod.map((row) => <tr key={row.method}><td className="px-4 py-3 font-bold text-slate-900">{row.method}</td><td className="px-4 py-3 text-right text-slate-600">{row.count}</td><td className="px-4 py-3 text-right text-slate-700">{formatMoney(row.received, currency)}</td><td className="px-4 py-3 text-right font-bold text-emerald-700">{formatMoney(row.reconciled, currency)}</td></tr>)}</tbody></table></div>}</section>
        <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Por unidade</h2><p className="text-sm text-slate-500">Comparação operacional dentro do acesso atual.</p></div>{!report?.byBranch.length ? <FoodEmptyState icon={Store} title="Sem unidades no relatório" description="Selecione outra unidade ou período." /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Unidade</th><th className="px-4 py-3 text-right">Pedidos</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Recebido</th></tr></thead><tbody className="divide-y divide-slate-100">{report.byBranch.map((row) => <tr key={row.branchId}><td className="px-4 py-3 font-bold text-slate-900">{row.branchName}</td><td className="px-4 py-3 text-right text-slate-600">{row.orders}</td><td className="px-4 py-3 text-right text-slate-700">{formatMoney(row.orderValue, currency)}</td><td className="px-4 py-3 text-right font-bold text-emerald-700">{formatMoney(row.received, currency)}</td></tr>)}</tbody></table></div>}</section>
      </div>

      <section><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">Valores pendentes de entregadores</h2><p className="text-sm text-slate-500">Cada linha abre diretamente do agregado de cobrança Delivery.</p></div><Badge variant={report?.pending.collections.some((item) => item.state === 'discrepancy') ? 'destructive' : 'secondary'}>{report?.pending.collections.length ?? 0}</Badge></div>{!report?.pending.collections.length ? <FoodEmptyState icon={Bike} title="Sem valores pendentes" description="Todas as cobranças de Delivery estão reconciliadas." /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Pedido</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3 text-right">Esperado</th><th className="px-4 py-3 text-right">Diferença</th><th className="px-4 py-3">Actualização</th></tr></thead><tbody className="divide-y divide-slate-100">{report.pending.collections.map((item) => <tr key={item.id}><td className="px-4 py-3 font-black text-slate-950">#{String(item.orderNumber).padStart(4, '0')}</td><td className="px-4 py-3 text-slate-600">{item.branchName}</td><td className="px-4 py-3"><Badge variant={item.state === 'discrepancy' || item.state === 'not_received' ? 'destructive' : 'secondary'}>{COLLECTION_LABELS[item.state] || item.state}</Badge>{item.exceptionReason ? <p className="mt-1 max-w-xs text-xs text-red-700">{item.exceptionReason}</p> : null}</td><td className="px-4 py-3 text-slate-600">{item.customerName || 'Cliente'}</td><td className="px-4 py-3 text-right font-bold text-slate-900">{formatMoney(item.expectedAmount, currency)}</td><td className={`px-4 py-3 text-right font-bold ${Number(item.discrepancyAmount || 0) ? 'text-red-700' : 'text-slate-400'}`}>{formatMoney(item.discrepancyAmount || 0, currency)}</td><td className="px-4 py-3 text-slate-500">{formatDate(item.updatedAt)}</td></tr>)}</tbody></table></div></div>}</section>

      <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Stock e compras</h2><p className="text-sm text-slate-500">Inventário atual e movimentos do período selecionado.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Valor em stock" value={formatMoney(report?.stock.inventoryValue || 0, currency)} detail="Custo médio atual" icon={Scale} tone="bg-blue-50 text-blue-700" /><Metric label="Stock em alerta" value={String(report?.stock.lowStock || 0)} detail="No mínimo ou abaixo" icon={AlertTriangle} tone="bg-red-50 text-red-700" /><Metric label="Movimentos" value={String(report?.stock.movementCount || 0)} detail={formatMoney(report?.stock.movementValue || 0, currency)} icon={PackageCheck} tone="bg-cyan-50 text-cyan-700" /><Metric label="Compras recebidas" value={formatMoney(summaryOrZero.purchasesReceived, currency)} detail="Parciais e concluídas" trend={comparison.purchasesReceived} icon={WalletCards} tone="bg-amber-50 text-amber-700" /></div></section>

      <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Histórico diário</h2><p className="text-sm text-slate-500">Base para conferir alterações e comparar dias.</p></div><div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="max-h-[440px] overflow-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3 text-right">Pedidos</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Recebido</th><th className="px-4 py-3 text-right">Conciliado</th></tr></thead><tbody className="divide-y divide-slate-100">{[...(report?.daily ?? [])].reverse().map((row) => <tr key={row.date}><td className="px-4 py-3 font-semibold text-slate-800">{formatDate(row.date)}</td><td className="px-4 py-3 text-right text-slate-600">{row.orders}</td><td className="px-4 py-3 text-right text-slate-700">{formatMoney(row.orderValue, currency)}</td><td className="px-4 py-3 text-right text-slate-700">{formatMoney(row.received, currency)}</td><td className="px-4 py-3 text-right font-bold text-emerald-700">{formatMoney(row.reconciled, currency)}</td></tr>)}</tbody></table></div></div></section>
    </>}
    <FoodConfirmDialog open={confirmClose} onOpenChange={setConfirmClose} title={`Fechar ${closeMonth}?`} description="Os valores atuais serão guardados num snapshot imutável. Novos movimentos não alterarão este fecho." confirmLabel="Criar snapshot" pending={closeMutation.isPending} onConfirm={() => closeMutation.mutate()} />
    {printClose ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 md:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closePrintPreview(); }}><Card className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden border-slate-200 bg-white p-0 shadow-xl"><div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><h2 className="truncate text-base font-black text-slate-950">Imprimir fecho {printClose.month.slice(0, 7)}</h2><p className="text-xs text-slate-500">Pré-visualização do snapshot preservado.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-md border border-slate-200 bg-slate-50 p-1"><Button size="sm" variant={!printRevisionId ? 'default' : 'ghost'} disabled={printMutation.isPending} onClick={() => openPrintPreview(printClose)}>Original</Button>{printClose.revisions.map((revision) => <Button key={revision.id} size="sm" variant={printRevisionId === revision.id ? 'default' : 'ghost'} disabled={printMutation.isPending} onClick={() => openPrintPreview(printClose, revision.id)}>Revisão {revision.revisionNumber}</Button>)}</div><Button disabled={!printUrl || printMutation.isPending} onClick={() => printFrameRef.current?.contentWindow?.print()}><Printer className="mr-2 h-4 w-4" />Imprimir</Button><Button size="icon" variant="ghost" title="Fechar pré-visualização" onClick={closePrintPreview}><X className="h-4 w-4" /></Button></div></div><div className="min-h-0 flex-1 bg-slate-100 p-2 md:p-3">{printMutation.isPending ? <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">A preparar documento...</div> : printMutation.isError ? <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><p className="font-bold text-red-700">{getApiErrorMessage(printMutation.error)}</p><Button variant="outline" onClick={() => printMutation.mutate({ closeId: printClose.id, revisionId: printRevisionId })}>Tentar novamente</Button></div> : printUrl ? <iframe ref={printFrameRef} className="h-full w-full border-0 bg-white" src={printUrl} title={`Fecho ${printClose.month.slice(0, 7)} para impressão`} /> : null}</div></Card></div> : null}
    {reopening ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setReopening(null); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Reabrir {reopening.month.slice(0, 7)}</h2><p className="mt-1 text-sm text-slate-500">O snapshot original será preservado. Registe por que o mês precisa de correcções.</p><Input className="mt-4" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Motivo obrigatório" />{reopenMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-700">{getApiErrorMessage(reopenMutation.error)}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={reopenMutation.isPending} onClick={() => setReopening(null)}>Cancelar</Button><Button variant="destructive" disabled={reopenReason.trim().length < 5 || reopenMutation.isPending} onClick={() => reopenMutation.mutate()}>Confirmar reabertura</Button></div></Card></div> : null}
    {reclosing ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setReclosing(null); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Fechar novamente {reclosing.month.slice(0, 7)}</h2><p className="mt-1 text-sm text-slate-500">Será criada uma nova revisão imutável. O original e as revisões anteriores não serão alterados.</p><Input className="mt-4" value={recloseReason} onChange={(event) => setRecloseReason(event.target.value)} placeholder="Correcções efectuadas" />{recloseMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-700">{getApiErrorMessage(recloseMutation.error)}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={recloseMutation.isPending} onClick={() => setReclosing(null)}>Cancelar</Button><Button disabled={recloseReason.trim().length < 5 || recloseMutation.isPending} onClick={() => recloseMutation.mutate()}>Criar nova revisão</Button></div></Card></div> : null}
  </div>;
}
