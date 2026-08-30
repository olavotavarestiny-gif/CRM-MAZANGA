'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, ChefHat, CircleDollarSign, KeyRound, LockKeyhole, LogOut, Plus, ReceiptText, Store } from 'lucide-react';
import {
  closeFoodCashSession,
  configureOwnFoodStaffPin,
  endFoodShift,
  executeFoodOrderCommand,
  getCurrentFoodCashSession,
  getCurrentFoodWorkforce,
  getFoodContext,
  getFoodKitchenEscalations,
  getFoodSettings,
  getFoodV1Orders,
  issueFoodFiscalDocument,
  openFoodCashSession,
  recordFoodPayment,
  resolveFoodKitchenIssue,
} from '@/lib/api';
import type { FoodOrder } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { useFoodRealtime } from '@/hooks/use-food-realtime';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { FoodBranchSelect } from '@/components/food/food-branch-select';
import { FoodStatusBadge } from '@/components/food/food-status-badge';

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))} Kz`;
}

function orderTypeLabel(order: FoodOrder) {
  if (order.orderType === 'delivery') return 'Delivery';
  if (order.orderType === 'dine_in') return order.tableName ? `Mesa ${order.tableName}` : 'No local';
  return 'Levantamento';
}

export default function FoodCashierPage() {
  const queryClient = useQueryClient();
  useFoodRealtime();
  const [branchId, setBranchId] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [showClosing, setShowClosing] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [paymentOrder, setPaymentOrder] = useState<FoodOrder | null>(null);
  const [payment, setPayment] = useState({ amount: '', method: 'CASH', transactionReference: '' });
  const [issueToResolve, setIssueToResolve] = useState<{ ticketId: string; itemId: string; productName: string; issueNote?: string | null } | null>(null);
  const [issueResolution, setIssueResolution] = useState('Alteração confirmada com o cliente.');
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const branches = contextQuery.data?.branches ?? [];

  useEffect(() => {
    if (!branchId && branches.length > 0) setBranchId(branches.find((branch) => branch.isMain)?.id || branches[0].id);
  }, [branchId, branches]);

  useEffect(() => {
    const key = 'kukugest-food-device-id';
    const existing = window.localStorage.getItem(key);
    const value = existing || globalThis.crypto?.randomUUID?.() || `food-device-${Date.now()}`;
    if (!existing) window.localStorage.setItem(key, value);
    setDeviceId(value);
  }, []);

  const workforceQuery = useQuery({
    queryKey: ['food-workforce-current', branchId],
    queryFn: () => getCurrentFoodWorkforce(branchId),
    enabled: Boolean(branchId),
    refetchInterval: 10_000,
  });

  const sessionQuery = useQuery({
    queryKey: ['food-cash-session', branchId],
    queryFn: () => getCurrentFoodCashSession(branchId),
    enabled: Boolean(branchId),
    refetchInterval: 10_000,
  });
  const ordersQuery = useQuery({
    queryKey: ['food-v1-orders', branchId],
    queryFn: () => getFoodV1Orders({ branchId, limit: 100 }),
    enabled: Boolean(branchId),
    refetchInterval: 5_000,
  });
  const kitchenEscalationsQuery = useQuery({
    queryKey: ['food-kitchen-escalations', branchId],
    queryFn: () => getFoodKitchenEscalations(branchId),
    enabled: Boolean(branchId),
    refetchInterval: 5_000,
  });

  const refreshCash = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['food-cash-session'] }),
      queryClient.invalidateQueries({ queryKey: ['food-v1-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['food-workforce-current'] }),
      queryClient.invalidateQueries({ queryKey: ['food-kitchen-escalations'] }),
    ]);
  };
  const endShiftMutation = useMutation({
    mutationFn: () => endFoodShift(workforceQuery.data!.shift!.id, { pin: staffPin, deviceId }),
    onSuccess: async () => { setStaffPin(''); await refreshCash(); },
  });
  const beginWorkMutation = useMutation({
    mutationFn: async () => {
      const pin = workforceQuery.data?.credentialConfigured ? staffPin : newPin;
      if (!workforceQuery.data?.credentialConfigured) await configureOwnFoodStaffPin(pin);
      return openFoodCashSession({ branchId, openingBalance: Number(openingBalance), pin, deviceId, startShift: true });
    },
    onSuccess: async () => {
      setStaffPin('');
      setNewPin('');
      setNewPinConfirm('');
      await refreshCash();
    },
    onSettled: refreshCash,
  });
  const resetPinMutation = useMutation({
    mutationFn: () => configureOwnFoodStaffPin(newPin),
    onSuccess: async () => {
      setStaffPin(newPin);
      setNewPin('');
      setNewPinConfirm('');
      setShowPinReset(false);
      closeWorkMutation.reset();
      await refreshCash();
    },
  });
  const closeWorkMutation = useMutation({
    mutationFn: async () => {
      return closeFoodCashSession(sessionQuery.data!.id, { closingCountedAmount: Number(closingAmount), pin: staffPin, deviceId, notes: closingNotes || undefined, endShift: true });
    },
    onSuccess: async () => {
      setShowClosing(false);
      setStaffPin('');
      setClosingNotes('');
      setClosingAmount('');
      await refreshCash();
    },
    onSettled: refreshCash,
  });
  const commandMutation = useMutation({
    mutationFn: ({ order, command }: { order: FoodOrder; command: 'send_to_kitchen' | 'complete' }) => executeFoodOrderCommand(order.id, command, { expectedVersion: order.version }),
    onSuccess: refreshCash,
  });
  const paymentMutation = useMutation({
    mutationFn: () => recordFoodPayment(paymentOrder!.id, {
      amount: Number(payment.amount),
      method: payment.method,
      transactionReference: payment.transactionReference || undefined,
      cashSessionId: sessionQuery.data?.id,
    }),
    onSuccess: async () => {
      setPaymentOrder(null);
      setPayment({ amount: '', method: 'CASH', transactionReference: '' });
      await refreshCash();
    },
  });
  const fiscalMutation = useMutation({ mutationFn: (orderId: string) => issueFoodFiscalDocument(orderId), onSuccess: refreshCash });
  const resolveIssueMutation = useMutation({
    mutationFn: () => resolveFoodKitchenIssue(issueToResolve!.ticketId, issueToResolve!.itemId, issueResolution),
    onSuccess: async () => {
      setIssueToResolve(null);
      setIssueResolution('Alteração confirmada com o cliente.');
      await refreshCash();
    },
  });

  const activeOrders = useMemo(() => (ordersQuery.data ?? []).filter((order) => order.orderState !== 'completed' && order.orderState !== 'cancelled'), [ordersQuery.data]);
  const error = contextQuery.error || workforceQuery.error || sessionQuery.error || ordersQuery.error;
  if (error) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível abrir o caixa" message={getApiErrorMessage(error)} onRetry={() => Promise.all([contextQuery.refetch(), workforceQuery.refetch(), sessionQuery.refetch(), ordersQuery.refetch()])} /></div>;
  }

  const session = sessionQuery.data;
  const workforce = workforceQuery.data;
  const shift = workforce?.shift;
  const shiftMatchesBranch = shift?.branchId === branchId;
  const closingDifference = closingAmount && session ? Number(closingAmount) - Number(session.expectedClosingAmount) : 0;
  const openingPin = workforce?.credentialConfigured ? staffPin : newPin;
  const openingReady = openingPin.length >= 4
    && (workforce?.credentialConfigured || newPin === newPinConfirm)
    && Number.isFinite(Number(openingBalance))
    && Number(openingBalance) >= 0;
  const pinLocked = Boolean(workforce?.credentialLockedUntil && new Date(workforce.credentialLockedUntil).getTime() > Date.now());
  const closeClosingDialog = () => {
    setShowClosing(false);
    setShowPinReset(false);
    setNewPin('');
    setNewPinConfirm('');
  };
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="Caixa Food" title="Atendimento" description="Pedidos e pagamentos da unidade seleccionada. A emissão fiscal é opcional e pode ser configurada depois.">
        {session ? <Button asChild><Link href={`/food/novo-pedido?branch=${branchId}`}><Plus className="mr-2 h-4 w-4" />Novo pedido</Link></Button> : <Button disabled><Plus className="mr-2 h-4 w-4" />Novo pedido</Button>}
      </FoodPageHeader>

      {(kitchenEscalationsQuery.data ?? []).length > 0 ? <Card className="border-red-300 bg-red-50 p-4 shadow-sm"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /><div><p className="font-black text-red-950">Cozinha sem resposta</p><p className="mt-1 text-sm font-semibold text-red-800">{(kitchenEscalationsQuery.data ?? []).map((ticket) => ticket.order?.displayNumber || `#${ticket.orderId.slice(-4)}`).join(', ')} {kitchenEscalationsQuery.data?.length === 1 ? 'aguarda' : 'aguardam'} reconhecimento há mais de {settingsQuery.data?.kdsUnacceptedEscalationSeconds || 120} segundos.</p></div></div></Card> : null}

      {branches.length === 0 && !contextQuery.isLoading ? (
        <Card className="border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p className="font-bold">Nenhuma unidade disponível</p><p className="mt-1">Crie uma unidade Food ou peça acesso a um gestor.</p><Button asChild variant="outline" className="mt-4"><Link href="/food/configuracoes">Abrir configurações</Link></Button></Card>
      ) : (
        <Card className="border-slate-200 bg-white p-5 shadow-none">
          {session ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Store className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><h2 className="font-bold text-slate-950">Caixa aberto</h2><Badge variant="success">Em operação</Badge></div><p className="mt-1 text-sm text-slate-500">{session.branch?.name || 'Unidade'} · aberto às {new Date(session.openedAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })} · vendas {formatKz(session.totalSalesAmount)}</p></div></div>
              <Button variant="outline" onClick={() => setShowClosing(true)}><LockKeyhole className="mr-2 h-4 w-4" />Fechar Caixa</Button>
            </div>
          ) : (
            <div>
              <div className="mb-5"><h2 className="text-lg font-bold text-slate-950">Abrir Caixa</h2><p className="mt-1 text-sm text-slate-500">Confirme a unidade, o fundo inicial e o seu código.</p></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FoodBranchSelect branches={branches} value={branchId} onChange={setBranchId} />
                <div><Label>Fundo inicial</Label><Input className="mt-1" type="number" min="0" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} /></div>
                {workforce?.credentialConfigured ? <div><Label>Código pessoal</Label><Input className="mt-1" aria-label="Código pessoal" type="password" inputMode="numeric" maxLength={6} placeholder="4 a 6 dígitos" value={staffPin} onChange={(event) => setStaffPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div> : <><div><Label>Criar código pessoal</Label><Input className="mt-1" aria-label="Criar código pessoal" type="password" inputMode="numeric" maxLength={6} placeholder="4 a 6 dígitos" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div><div><Label>Confirmar código</Label><Input className="mt-1" aria-label="Confirmar código pessoal" type="password" inputMode="numeric" maxLength={6} placeholder="Repita o código" value={newPinConfirm} onChange={(event) => setNewPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div></>}
              </div>
              {shift ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-xs text-slate-500">Turno iniciado às {new Date(shift.startedAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })} em {shift.branch?.name || 'Unidade'}.</p><Button size="sm" variant="ghost" disabled={staffPin.length < 4 || endShiftMutation.isPending} onClick={() => endShiftMutation.mutate()}><LogOut className="mr-2 h-4 w-4" />Cancelar turno</Button></div> : null}
              {shift && !shiftMatchesBranch ? <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Existe um turno aberto em {shift.branch?.name || 'outra unidade'}. Seleccione essa unidade ou termine o turno.</p> : null}
              {(beginWorkMutation.isError || endShiftMutation.isError) ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(beginWorkMutation.error || endShiftMutation.error)}</p> : null}
              <div className="mt-5 flex justify-end"><Button disabled={!branchId || !openingReady || Boolean(shift && !shiftMatchesBranch) || beginWorkMutation.isPending} onClick={() => beginWorkMutation.mutate()}><KeyRound className="mr-2 h-4 w-4" />{beginWorkMutation.isPending ? 'A abrir...' : workforce?.credentialConfigured ? 'Abrir Caixa' : 'Criar código e abrir Caixa'}</Button></div>
            </div>
          )}
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-950">Pedidos em curso</h2><p className="text-sm text-slate-500">Actualização automática a cada cinco segundos.</p></div><Badge variant="secondary">{activeOrders.length}</Badge></div>
        {ordersQuery.isLoading ? <div className="h-48 animate-pulse rounded-lg bg-white" /> : activeOrders.length === 0 ? (
          <FoodEmptyState icon={CircleDollarSign} title="Sem pedidos em curso" description={session ? 'O caixa está pronto para iniciar um atendimento.' : 'Abra o caixa antes de criar pedidos.'} actionLabel={session ? 'Criar pedido' : undefined} onAction={session ? () => { window.location.href = `/food/novo-pedido?branch=${branchId}`; } : undefined} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {activeOrders.map((order) => {
              const paid = order.paymentState === 'paid';
              const fiscalIssued = order.fiscalDocuments?.some((document) => document.status === 'issued');
              const canSend = order.kitchenState === 'not_required' && order.orderState !== 'cancelled';
              const canComplete = order.kitchenState === 'ready' && order.orderType !== 'delivery';
              const unresolvedIssues = (order.items ?? []).filter((item) => item.kitchenTicketItem?.state === 'unavailable' && !item.kitchenTicketItem.issueResolvedAt);
              return (
                <Card key={order.id} className="border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xl font-black text-slate-950">{order.displayNumber}</p><p className="mt-1 text-xs font-semibold text-slate-500">{orderTypeLabel(order)}</p><FoodStatusBadge status={order.status} label={order.statusLabel} /></div><p className="text-base font-black text-slate-950">{formatKz(order.total)}</p></div>
                  <div className="mt-4 space-y-1">{(order.items ?? []).slice(0, 3).map((item) => <p key={item.id} className="truncate text-sm text-slate-700"><span className="font-bold">{item.quantity}x</span> {item.productName}</p>)}</div>
                  {unresolvedIssues.map((item) => <div key={item.id} className="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5"><p className="text-sm font-bold text-red-800"><AlertTriangle className="mr-1 inline h-4 w-4" />{item.productName} indisponível</p><p className="mt-1 text-xs text-red-700">{item.kitchenTicketItem?.issueNote}</p><Button size="sm" variant="outline" className="mt-2" onClick={() => setIssueToResolve({ ticketId: item.kitchenTicketItem!.ticketId, itemId: item.kitchenTicketItem!.id, productName: item.productName, issueNote: item.kitchenTicketItem!.issueNote })}>Confirmar com cliente</Button></div>)}
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {canSend ? <Button size="sm" disabled={commandMutation.isPending} onClick={() => commandMutation.mutate({ order, command: 'send_to_kitchen' })}><ChefHat className="mr-2 h-4 w-4" />Enviar cozinha</Button> : null}
                    {!paid ? <Button size="sm" variant="outline" disabled={!session} onClick={() => { setPaymentOrder(order); setPayment({ amount: String(Math.max(0, Number(order.total) - (order.payments ?? []).reduce((sum, item) => sum + Number(item.amount), 0))), method: 'CASH', transactionReference: '' }); }}><Banknote className="mr-2 h-4 w-4" />Receber</Button> : null}
                    {paid && !fiscalIssued ? <Button size="sm" variant="outline" disabled={fiscalMutation.isPending} onClick={() => fiscalMutation.mutate(order.id)}><ReceiptText className="mr-2 h-4 w-4" />Emitir factura</Button> : null}
                    {canComplete ? <Button size="sm" variant="outline" disabled={commandMutation.isPending} onClick={() => commandMutation.mutate({ order, command: 'complete' })}>Concluir</Button> : null}
                    {fiscalIssued ? <Badge variant="success">Facturado</Badge> : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {(commandMutation.isError || fiscalMutation.isError) ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(commandMutation.error || fiscalMutation.error)}</p> : null}
      </section>

      {showClosing && session ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget && !closeWorkMutation.isPending) closeClosingDialog(); }}>
          <Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-950">Fechar Caixa</h2><p className="mt-1 text-sm text-slate-500">Conte o valor disponível. O turno termina automaticamente.</p>
            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3"><p className="text-xs font-medium text-slate-500">Valor esperado</p><p className="mt-1 text-xl font-bold text-slate-950">{formatKz(session.expectedClosingAmount)}</p></div>
            <div className="mt-4 space-y-4"><div><Label>Valor contado</Label><Input className="mt-1" autoFocus type="number" min="0" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)} /></div>{Math.abs(closingDifference) > 0.005 ? <div><Label>Motivo da diferença</Label><Input className="mt-1" value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} placeholder="Explique a diferença" /></div> : null}{pinLocked || showPinReset ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-900">{pinLocked ? 'Código temporariamente bloqueado' : 'Definir novo código'}</p><p className="mt-1 text-xs text-amber-700">Crie um novo código de 4 a 6 dígitos para continuar.</p><div className="mt-3 grid grid-cols-2 gap-2"><Input aria-label="Novo código pessoal" type="password" inputMode="numeric" maxLength={6} placeholder="Novo código" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /><Input aria-label="Confirmar novo código" type="password" inputMode="numeric" maxLength={6} placeholder="Confirmar" value={newPinConfirm} onChange={(event) => setNewPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div><div className="mt-3 flex justify-end gap-2">{!pinLocked ? <Button size="sm" variant="ghost" onClick={() => setShowPinReset(false)}>Voltar</Button> : null}<Button size="sm" disabled={newPin.length < 4 || newPin !== newPinConfirm || resetPinMutation.isPending} onClick={() => resetPinMutation.mutate()}>{resetPinMutation.isPending ? 'A guardar...' : 'Guardar novo código'}</Button></div>{resetPinMutation.isError ? <p className="mt-2 text-xs font-semibold text-red-600">{getApiErrorMessage(resetPinMutation.error)}</p> : null}</div> : <div><div className="flex items-center justify-between gap-3"><Label>Código pessoal</Label><button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => { setShowPinReset(true); setStaffPin(''); }}>Redefinir código</button></div><Input className="mt-1" type="password" inputMode="numeric" maxLength={6} value={staffPin} onChange={(event) => setStaffPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></div>}</div>
            {closeWorkMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(closeWorkMutation.error)}</p> : null}
            <div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={closeWorkMutation.isPending} onClick={closeClosingDialog}>Cancelar</Button><Button disabled={pinLocked || showPinReset || !closingAmount || staffPin.length < 4 || (Math.abs(closingDifference) > 0.005 && closingNotes.trim().length < 3) || closeWorkMutation.isPending} onClick={() => closeWorkMutation.mutate()}><LockKeyhole className="mr-2 h-4 w-4" />{closeWorkMutation.isPending ? 'A fechar...' : 'Fechar Caixa e turno'}</Button></div>
          </Card>
        </div>
      ) : null}

      {paymentOrder ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentOrder(null); }}>
          <Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-black text-slate-950">Receber {paymentOrder.displayNumber}</h2><p className="mt-1 text-sm text-slate-500">O pagamento fica registado no Food mesmo sem vínculo fiscal.</p>
            <div className="mt-4 space-y-4"><div><Label>Valor</Label><Input className="mt-1" type="number" min="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></div><div><Label>Método</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })}>{(settingsQuery.data?.paymentMethods ?? ['CASH', 'MULTICAIXA', 'TRANSFER']).map((method) => <option key={method} value={method}>{method}</option>)}</select></div><div><Label>Referência</Label><Input className="mt-1" value={payment.transactionReference} onChange={(event) => setPayment({ ...payment, transactionReference: event.target.value })} /></div></div>
            {paymentMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(paymentMutation.error)}</p> : null}
            <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setPaymentOrder(null)}>Cancelar</Button><Button disabled={!payment.amount || Number(payment.amount) <= 0 || paymentMutation.isPending} onClick={() => paymentMutation.mutate()}>Confirmar pagamento</Button></div>
          </Card>
        </div>
      ) : null}

      {issueToResolve ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setIssueToResolve(null); }}>
          <Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Confirmar alteração</h2><p className="mt-1 text-sm text-slate-500">{issueToResolve.productName}: {issueToResolve.issueNote}</p><div className="mt-4"><Label>Resolução acordada</Label><Input className="mt-1" value={issueResolution} onChange={(event) => setIssueResolution(event.target.value)} /></div>{resolveIssueMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(resolveIssueMutation.error)}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setIssueToResolve(null)}>Cancelar</Button><Button disabled={issueResolution.trim().length < 3 || resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate()}>Guardar confirmação</Button></div></Card>
        </div>
      ) : null}
    </div>
  );
}
