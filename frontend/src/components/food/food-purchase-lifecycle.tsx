'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, History, PackageCheck, Send, Truck, X } from 'lucide-react';
import { commandFoodPurchase, receiveFoodPurchaseItems } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import type { FoodPurchase } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const statusLabels: Record<FoodPurchase['status'], string> = {
  draft: 'Rascunho',
  awaiting_confirmation: 'Aguarda confirmação',
  confirmed: 'Confirmada',
  in_delivery: 'Em entrega',
  partial: 'Receção parcial',
  received: 'Recebida',
  cancelled: 'Cancelada',
  ordered: 'Encomendada (legado)',
};

export function FoodPurchaseStatus({ purchase }: { purchase: FoodPurchase }) {
  const tone = purchase.status === 'received'
    ? 'bg-emerald-50 text-emerald-700'
    : purchase.status === 'cancelled'
      ? 'bg-slate-100 text-slate-600'
      : purchase.status === 'partial'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-amber-50 text-amber-700';
  return <div><span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${tone}`}>{statusLabels[purchase.status]}</span><p className="mt-1 text-xs text-slate-400">v{purchase.version}</p></div>;
}

export function FoodPurchaseLifecycle({ purchase, canEdit }: { purchase: FoodPurchase; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['food-purchases'] }),
      queryClient.invalidateQueries({ queryKey: ['food-ingredients'] }),
      queryClient.invalidateQueries({ queryKey: ['food-management-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['food-stock-replenishment'] }),
      queryClient.invalidateQueries({ queryKey: ['food-purchase-suggestions'] }),
    ]);
  };
  const commandMutation = useMutation({
    mutationFn: ({ command, reason }: { command: 'submit' | 'confirm' | 'dispatch' | 'cancel'; reason?: string }) => commandFoodPurchase(purchase.id, { command, version: purchase.version, reason }),
    onSuccess: async () => {
      setCancelOpen(false);
      setCancelReason('');
      await refresh();
    },
  });
  const receiptMutation = useMutation({
    mutationFn: () => receiveFoodPurchaseItems(purchase.id, {
      version: purchase.version,
      items: (purchase.items || []).map((item) => ({ purchaseItemId: item.id, quantity: Number(quantities[item.id] || 0) })).filter((item) => item.quantity > 0),
    }),
    onSuccess: async () => {
      setReceiveOpen(false);
      setQuantities({});
      await refresh();
    },
  });
  const openReceipt = () => {
    setQuantities(Object.fromEntries((purchase.items || []).map((item) => [item.id, String(Math.max(0, Number(item.quantity) - Number(item.receivedQuantity || 0)))])));
    setReceiveOpen(true);
  };
  const canCancel = ['draft', 'awaiting_confirmation', 'confirmed', 'in_delivery', 'ordered'].includes(purchase.status);
  const canReceive = ['confirmed', 'in_delivery', 'partial', 'ordered'].includes(purchase.status);
  const hasReceipt = (purchase.items || []).some((item) => Number(quantities[item.id] || 0) > 0 && Number(quantities[item.id]) <= Number(item.quantity) - Number(item.receivedQuantity || 0));
  const error = commandMutation.error || receiptMutation.error;

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button type="button" size="icon" variant="ghost" title="Ver histórico" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" /></Button>
        {canEdit ? <>
          {purchase.status === 'draft' ? <Button type="button" size="sm" disabled={commandMutation.isPending} onClick={() => commandMutation.mutate({ command: 'submit' })}><Send className="mr-2 h-4 w-4" />Enviar</Button> : null}
          {purchase.status === 'awaiting_confirmation' ? <Button type="button" size="sm" disabled={commandMutation.isPending} onClick={() => commandMutation.mutate({ command: 'confirm' })}><Check className="mr-2 h-4 w-4" />Confirmar</Button> : null}
          {purchase.status === 'confirmed' ? <Button type="button" size="sm" variant="outline" disabled={commandMutation.isPending} onClick={() => commandMutation.mutate({ command: 'dispatch' })}><Truck className="mr-2 h-4 w-4" />Em entrega</Button> : null}
          {canReceive ? <Button type="button" size="sm" disabled={receiptMutation.isPending} onClick={openReceipt}><PackageCheck className="mr-2 h-4 w-4" />Receber</Button> : null}
          {canCancel ? <Button type="button" size="icon" variant="ghost" title="Cancelar compra" onClick={() => setCancelOpen(true)}><X className="h-4 w-4 text-red-600" /></Button> : null}
        </> : null}
      </div>
      {error ? <p className="mt-2 text-right text-xs font-semibold text-red-600">{getApiErrorMessage(error)}</p> : null}

      {receiveOpen ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setReceiveOpen(false); }}><Card className="w-full max-w-xl border-slate-200 bg-white p-5 shadow-xl"><h3 className="text-lg font-black text-slate-950">Confirmar receção</h3><p className="mt-1 text-sm text-slate-500">Registe apenas o que chegou. O restante permanece pendente.</p><div className="mt-4 divide-y divide-slate-100">{(purchase.items || []).map((item) => { const remaining = Math.max(0, Number(item.quantity) - Number(item.receivedQuantity || 0)); return <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_130px] items-center gap-3 py-3"><div><p className="font-bold text-slate-950">{item.ingredient?.name}</p><p className="text-xs text-slate-500">Recebido {item.receivedQuantity || 0} de {item.quantity} {item.ingredient?.unit}</p></div><div><Label className="sr-only">Quantidade recebida</Label><Input type="number" min="0" max={remaining} step="0.001" value={quantities[item.id] || '0'} onChange={(event) => setQuantities({ ...quantities, [item.id]: event.target.value })} /></div></div>; })}</div>{receiptMutation.error ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(receiptMutation.error)}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setReceiveOpen(false)}>Cancelar</Button><Button type="button" disabled={!hasReceipt || receiptMutation.isPending} onClick={() => receiptMutation.mutate()}>{receiptMutation.isPending ? 'A confirmar...' : 'Confirmar receção'}</Button></div></Card></div> : null}

      {cancelOpen ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelOpen(false); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h3 className="text-lg font-black text-slate-950">Cancelar compra?</h3><p className="mt-1 text-sm text-slate-500">A compra deixa de contar como stock pendente. Esta decisão fica no histórico.</p><div className="mt-4"><Label>Motivo *</Label><Input className="mt-1" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div>{commandMutation.error ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(commandMutation.error)}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button><Button type="button" variant="destructive" disabled={cancelReason.trim().length < 3 || commandMutation.isPending} onClick={() => commandMutation.mutate({ command: 'cancel', reason: cancelReason })}>Cancelar compra</Button></div></Card></div> : null}

      {historyOpen ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}><Card className="max-h-[85vh] w-full max-w-lg overflow-y-auto border-slate-200 bg-white p-5 shadow-xl"><h3 className="text-lg font-black text-slate-950">Histórico da compra</h3><p className="mt-1 text-sm text-slate-500">{purchase.reference || `Compra ${purchase.id.slice(-6)}`} · versão {purchase.version}</p><div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">{purchase.events?.length ? purchase.events.map((event) => <div key={event.id} className="py-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{event.type === 'purchase.created' ? 'Compra criada' : event.type === 'receipt.confirmed' ? 'Receção confirmada' : event.type.replace('command.', 'Comando: ')}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString('pt-AO')}</p></div><span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">v{event.version}</span></div>{event.statusTo ? <p className="mt-2 text-sm text-slate-600">{event.statusFrom || 'início'} → {event.statusTo}</p> : null}</div>) : <p className="py-6 text-center text-sm text-slate-500">Compra anterior ao histórico versionado.</p>}</div><div className="mt-5 flex justify-end"><Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>Fechar</Button></div></Card></div> : null}
    </>
  );
}
