'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Bike, CircleAlert, Clock3, KeyRound, MapPin, Phone, Truck, UserRoundCheck } from 'lucide-react';
import { getFoodCouriers, getFoodDeliveries, getFoodSettings, reconcileFoodDeliveryCollection, regenerateFoodDeliveryPin, transitionFoodDelivery } from '@/lib/api';
import type { FoodDelivery, FoodDeliveryState } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { useFoodRealtime } from '@/hooks/use-food-realtime';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';

const STATE_LABELS: Record<FoodDeliveryState, string> = {
  not_required: 'Não aplicável', pending: 'Pendente', awaiting_dispatch: 'Aguardando despacho', assigned: 'Atribuído', approaching_pickup: 'A caminho da recolha', picked_up: 'Recolhido', out_for_delivery: 'Em entrega', arrived: 'No destino', delivered: 'Entregue', failed: 'Falhou', returned: 'Devolvido',
};

const COURIER_STATUS_LABELS: Record<string, string> = {
  available: 'Disponível', unavailable: 'Indisponível', off_shift: 'Fora do turno', assigned: 'Atribuído', heading_pickup: 'A recolher', at_restaurant: 'No restaurante', delivering: 'Em entrega', no_gps: 'Sem GPS', problem: 'Com problema',
};

const COLLECTION_LABELS: Record<string, string> = {
  pending_collection: 'Por cobrar', with_courier: 'Com o entregador', handed_to_cashier: 'Entregue ao caixa',
  reconciled: 'Reconciliado', not_received: 'Não recebido', discrepancy: 'Com diferença', returned: 'Devolvido',
};

function formatTime(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-AO', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function FoodDeliveryManagerPage() {
  const queryClient = useQueryClient();
  useFoodRealtime();
  const [courierByDelivery, setCourierByDelivery] = useState<Record<string, string>>({});
  const [incident, setIncident] = useState<FoodDelivery | null>(null);
  const [reason, setReason] = useState('');
  const [revealedPin, setRevealedPin] = useState<{ id: string; pin: string } | null>(null);
  const [reconcileDelivery, setReconcileDelivery] = useState<FoodDelivery | null>(null);
  const [countedAmount, setCountedAmount] = useState('');
  const [reconcileReason, setReconcileReason] = useState('');
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const deliveriesQuery = useQuery({ queryKey: ['food-deliveries'], queryFn: () => getFoodDeliveries(), refetchInterval: 5_000 });
  const couriersQuery = useQuery({ queryKey: ['food-couriers'], queryFn: () => getFoodCouriers() });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['food-deliveries'] }),
      queryClient.invalidateQueries({ queryKey: ['food-v1-orders'] }),
    ]);
  };
  const transitionMutation = useMutation({
    mutationFn: ({ delivery, state, courierUserId, transitionReason }: { delivery: FoodDelivery; state: FoodDeliveryState; courierUserId?: number; transitionReason?: string }) => transitionFoodDelivery(delivery.id, state, { courierUserId, reason: transitionReason }),
    onSuccess: async () => {
      setIncident(null);
      setReason('');
      await refresh();
    },
  });
  const pinMutation = useMutation({
    mutationFn: (delivery: FoodDelivery) => regenerateFoodDeliveryPin(delivery.id).then((result) => ({ id: delivery.id, pin: result.pin })),
    onSuccess: setRevealedPin,
  });
  const reconcileMutation = useMutation({
    mutationFn: () => reconcileFoodDeliveryCollection(reconcileDelivery!.collection!.id, { countedAmount: Number(countedAmount), reason: reconcileReason.trim() || undefined }),
    onSuccess: async () => { setReconcileDelivery(null); setCountedAmount(''); setReconcileReason(''); await refresh(); },
  });

  const groups = useMemo(() => {
    const deliveries = deliveriesQuery.data ?? [];
    return {
      waiting: deliveries.filter((delivery) => ['pending', 'awaiting_dispatch'].includes(delivery.state)),
      active: deliveries.filter((delivery) => ['assigned', 'approaching_pickup', 'picked_up', 'out_for_delivery', 'arrived'].includes(delivery.state)),
      closed: deliveries.filter((delivery) => ['delivered', 'failed', 'returned'].includes(delivery.state)),
    };
  }, [deliveriesQuery.data]);

  if (deliveriesQuery.isError || couriersQuery.isError) {
    const error = deliveriesQuery.error || couriersQuery.error;
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível abrir o Delivery" message={getApiErrorMessage(error)} onRetry={() => Promise.all([deliveriesQuery.refetch(), couriersQuery.refetch()])} /></div>;
  }

  const renderDelivery = (delivery: FoodDelivery) => {
    const order = delivery.order;
    const selectedCourier = courierByDelivery[delivery.id] || String(delivery.courierUserId || '');
    const courier = couriersQuery.data?.find((item) => item.personId === delivery.courierUserId);
    return (
      <Card key={delivery.id} className="border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-slate-950">{order?.displayNumber || 'Pedido'}</p><p className="mt-1 text-xs font-semibold text-slate-500"><Clock3 className="mr-1 inline h-3.5 w-3.5" />{formatTime(order?.readyAt || delivery.createdAt)} · {delivery.branch?.name}</p></div><Badge variant={delivery.state === 'delivered' ? 'success' : delivery.state === 'failed' ? 'destructive' : 'secondary'}>{STATE_LABELS[delivery.state]}</Badge></div>
        <div className="mt-4 space-y-2 text-sm"><p className="font-bold text-slate-950">{order?.customerName || 'Cliente'}</p>{order?.customerPhone ? <p className="text-slate-600"><Phone className="mr-2 inline h-4 w-4" />{order.customerPhone}</p> : null}<p className="text-slate-600"><MapPin className="mr-2 inline h-4 w-4" />{order?.deliveryAddress || 'Morada não indicada'}{order?.deliveryNeighborhood ? `, ${order.deliveryNeighborhood}` : ''}</p>{courier ? <p className="font-semibold text-cyan-700"><Bike className="mr-2 inline h-4 w-4" />{courier.person.name} · {COURIER_STATUS_LABELS[courier.operationalStatus] || courier.operationalStatus}</p> : null}</div>
        {delivery.collection ? <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><div><p className="text-xs font-bold uppercase text-slate-500">{COLLECTION_LABELS[delivery.collection.state] || delivery.collection.state}</p><p className="font-black text-slate-950">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: settingsQuery.data?.currency || 'AOA' }).format(delivery.collection.expectedAmount)}</p></div><Banknote className="h-5 w-5 text-emerald-700" /></div> : null}
        {['pending', 'awaiting_dispatch', 'assigned', 'failed'].includes(delivery.state) ? <div className="mt-4 flex gap-2"><select className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm" value={selectedCourier} onChange={(event) => setCourierByDelivery((current) => ({ ...current, [delivery.id]: event.target.value }))}><option value="">Escolher entregador</option>{(couriersQuery.data ?? []).map((assignment) => <option key={assignment.id} value={assignment.personId} disabled={!assignment.assignmentEligible && assignment.personId !== delivery.courierUserId}>{assignment.person.name} · {COURIER_STATUS_LABELS[assignment.operationalStatus] || assignment.operationalStatus}</option>)}</select><Button disabled={!selectedCourier || transitionMutation.isPending || !(couriersQuery.data ?? []).some((assignment) => assignment.personId === Number(selectedCourier) && (assignment.assignmentEligible || assignment.personId === delivery.courierUserId))} onClick={() => transitionMutation.mutate({ delivery, state: 'assigned', courierUserId: Number(selectedCourier) })}><UserRoundCheck className="mr-2 h-4 w-4" />{delivery.state === 'failed' ? 'Reatribuir' : 'Atribuir'}</Button></div> : null}
        {!['delivered', 'returned'].includes(delivery.state) ? <div className="mt-3 flex flex-wrap gap-2">{delivery.state === 'arrived' && order?.paymentState === 'paid' && !delivery.collection ? <Button size="sm" variant="outline" disabled={pinMutation.isPending} onClick={() => pinMutation.mutate(delivery)}><KeyRound className="mr-2 h-4 w-4" />Gerar PIN</Button> : null}{delivery.state !== 'failed' ? <Button size="sm" variant="outline" onClick={() => setIncident(delivery)}><CircleAlert className="mr-2 h-4 w-4" />Incidente</Button> : null}{delivery.state === 'failed' ? <Button size="sm" variant="outline" disabled={transitionMutation.isPending} onClick={() => transitionMutation.mutate({ delivery, state: 'returned', transitionReason: 'Devolução confirmada pelo gestor.' })}>Confirmar devolução</Button> : null}</div> : null}
        {['handed_to_cashier', 'discrepancy'].includes(delivery.collection?.state || '') ? <Button className="mt-3 w-full" disabled={reconcileMutation.isPending} onClick={() => { setReconcileDelivery(delivery); setCountedAmount(String(delivery.collection?.expectedAmount || '')); setReconcileReason(''); }}><Banknote className="mr-2 h-4 w-4" />{delivery.collection?.state === 'discrepancy' ? 'Resolver diferença' : 'Reconciliar no caixa'}</Button> : null}
        {revealedPin?.id === delivery.id ? <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-xs font-bold uppercase text-amber-700">PIN de entrega</p><p className="font-mono text-2xl font-black tracking-normal text-amber-950">{revealedPin.pin}</p><p className="text-xs text-amber-800">Comunique-o ao cliente por canal seguro.</p></div> : null}
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="Delivery" title="Despacho e acompanhamento" description="A entrega começa apenas quando a cozinha marca o pedido como pronto." />
      {deliveriesQuery.isLoading ? <div className="h-72 animate-pulse rounded-lg bg-white" /> : (deliveriesQuery.data ?? []).length === 0 ? <FoodEmptyState icon={Truck} title="Sem entregas na fila" description="Pedidos Delivery prontos aparecerão aqui automaticamente." /> : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <section><div className="mb-3 flex items-center justify-between"><h2 className="font-black text-slate-950">Aguardam despacho</h2><Badge variant="secondary">{groups.waiting.length}</Badge></div><div className="space-y-3">{groups.waiting.map(renderDelivery)}</div></section>
          <section><div className="mb-3 flex items-center justify-between"><h2 className="font-black text-slate-950">Em curso</h2><Badge variant="secondary">{groups.active.length}</Badge></div><div className="space-y-3">{groups.active.map(renderDelivery)}</div></section>
          <section><div className="mb-3 flex items-center justify-between"><h2 className="font-black text-slate-950">Concluídas e ocorrências</h2><Badge variant="secondary">{groups.closed.length}</Badge></div><div className="space-y-3">{groups.closed.map(renderDelivery)}</div></section>
        </div>
      )}
      {(transitionMutation.isError || pinMutation.isError || reconcileMutation.isError) ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(transitionMutation.error || pinMutation.error || reconcileMutation.error)}</p> : null}

      {incident ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setIncident(null); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Registar falha</h2><p className="mt-1 text-sm text-slate-500">A entrega poderá depois ser reatribuída ou devolvida.</p><Input className="mt-4" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo da falha" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setIncident(null)}>Cancelar</Button><Button variant="destructive" disabled={!reason.trim() || transitionMutation.isPending} onClick={() => transitionMutation.mutate({ delivery: incident, state: 'failed', transitionReason: reason })}>Registar falha</Button></div></Card></div> : null}
      {reconcileDelivery ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setReconcileDelivery(null); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Reconciliar cobrança</h2><p className="mt-1 text-sm text-slate-500">Esperado: {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: settingsQuery.data?.currency || 'AOA' }).format(reconcileDelivery.collection?.expectedAmount || 0)}</p><label className="mt-4 block text-xs font-bold uppercase text-slate-500">Valor contado</label><Input className="mt-2" type="number" min="0" step="0.01" value={countedAmount} onChange={(event) => setCountedAmount(event.target.value)} />{Number(countedAmount) !== Number(reconcileDelivery.collection?.expectedAmount) ? <><label className="mt-4 block text-xs font-bold uppercase text-slate-500">Justificação da diferença</label><Input className="mt-2" value={reconcileReason} onChange={(event) => setReconcileReason(event.target.value)} placeholder="Motivo obrigatório" /></> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setReconcileDelivery(null)}>Cancelar</Button><Button disabled={!countedAmount || (Number(countedAmount) !== Number(reconcileDelivery.collection?.expectedAmount) && reconcileReason.trim().length < 3) || reconcileMutation.isPending} onClick={() => reconcileMutation.mutate()}>{Number(countedAmount) === Number(reconcileDelivery.collection?.expectedAmount) ? 'Reconciliar' : 'Registar diferença'}</Button></div></Card></div> : null}
    </div>
  );
}
