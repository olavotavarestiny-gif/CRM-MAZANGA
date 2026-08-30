'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChefHat,
  Clock3,
  MoreHorizontal,
  Phone,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import {
  executeFoodOrderCommand,
  getFoodSettings,
  getFoodV1Orders,
} from '@/lib/api';
import type { FoodOrder, FoodOrderStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { getFoodBrandStyle } from '@/components/food/food-ui';
import { cn } from '@/lib/utils';

type MainTab = 'active' | 'history';
type ActiveFilter = 'all' | 'kitchen' | 'ready' | 'delivery';
type HistoryFilter = 'completed' | 'cancelled';

const ACTIVE_FILTERS: Array<{ value: ActiveFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'kitchen', label: 'Cozinha' },
  { value: 'ready', label: 'Prontos' },
  { value: 'delivery', label: 'Em entrega' },
];

const HISTORY_FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: 'completed', label: 'Concluídos' },
  { value: 'cancelled', label: 'Cancelados' },
];

const ACTIVE_STATUSES: FoodOrderStatus[] = [
  'draft',
  'pending_confirmation',
  'confirmed',
  'sent_to_kitchen',
  'kitchen_accepted',
  'preparing',
  'ready',
  'awaiting_handoff',
  'out_for_delivery',
  'delivered',
];

const KITCHEN_STATUSES: FoodOrderStatus[] = ['sent_to_kitchen', 'kitchen_accepted', 'preparing'];
const READY_STATUSES: FoodOrderStatus[] = ['ready', 'awaiting_handoff'];
const DELIVERY_STATUSES: FoodOrderStatus[] = ['out_for_delivery', 'delivered'];

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

function minutesSince(value?: string | null) {
  if (!value) return 0;
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / 60000);
}

function orderStartTime(order: FoodOrder) {
  return order.sentToKitchenAt || order.confirmedAt || order.createdAt;
}

function formatTime(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-AO', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function timeState(order: FoodOrder, green = 15, yellow = 25) {
  const elapsed = minutesSince(orderStartTime(order));
  if (['completed', 'cancelled'].includes(order.status)) {
    return { elapsed, label: `${elapsed} min`, tone: 'neutral' as const, className: 'border-l-[#EAECF0]' };
  }
  if (elapsed > yellow) {
    return { elapsed, label: `Atrasado ${elapsed - yellow} min`, tone: 'danger' as const, className: 'border-l-[#D92D20]' };
  }
  if (elapsed > green) {
    return { elapsed, label: 'Atenção', tone: 'warning' as const, className: 'border-l-[#F79009]' };
  }
  return { elapsed, label: 'No prazo', tone: 'success' as const, className: 'border-l-[#12B76A]' };
}

function statusLabel(order: FoodOrder) {
  if (order.status === 'sent_to_kitchen' || order.status === 'kitchen_accepted') return 'Na cozinha';
  if (order.status === 'preparing') return 'Em preparação';
  if (order.status === 'ready' || order.status === 'awaiting_handoff') return 'Pronto';
  if (order.status === 'out_for_delivery') return 'Em entrega';
  if (order.status === 'delivered') return 'Entregue';
  return order.statusLabel;
}

function nextPrimaryAction(order: FoodOrder): { label: string; status: FoodOrderStatus; icon: typeof Check } | null {
  if (['draft', 'pending_confirmation', 'confirmed'].includes(order.status)) return { label: 'Enviar cozinha', status: 'sent_to_kitchen', icon: ChefHat };
  if (order.status === 'ready' && order.orderType === 'dine_in') return { label: 'Servir', status: 'completed', icon: Check };
  if (order.status === 'ready' && order.orderType !== 'delivery') return { label: 'Entregar cliente', status: 'completed', icon: Check };
  if (order.status === 'delivered') return { label: 'Fechar pedido', status: 'completed', icon: Check };
  return null;
}

function matchesActiveFilter(order: FoodOrder, filter: ActiveFilter) {
  if (filter === 'all') return true;
  if (filter === 'kitchen') return KITCHEN_STATUSES.includes(order.status);
  if (filter === 'ready') return READY_STATUSES.includes(order.status);
  return DELIVERY_STATUSES.includes(order.status);
}

function orderTypeShort(order: FoodOrder) {
  if (order.orderType === 'delivery') return 'Delivery';
  if (order.orderType === 'pickup') return 'Levantamento';
  return 'No local';
}

function paymentLabel(method?: string | null) {
  if (!method) return 'A definir';
  const labels: Record<string, string> = {
    CASH: 'Dinheiro',
    MULTICAIXA: 'Multicaixa',
    TPA: 'TPA',
    TRANSFER: 'Transferência',
    OTHER: 'Outro',
  };
  return labels[method] || method;
}

function OrderCard({
  order,
  highlighted,
  busy,
  settings,
  menuOpen,
  onMenu,
  onDetails,
  onAdvance,
  onCancel,
}: {
  order: FoodOrder;
  highlighted: boolean;
  busy: boolean;
  settings: { kdsGreenMinutes?: number; kdsYellowMinutes?: number };
  menuOpen: boolean;
  onMenu: () => void;
  onDetails: () => void;
  onAdvance: (status: FoodOrderStatus) => void;
  onCancel: () => void;
}) {
  const action = nextPrimaryAction(order);
  const ActionIcon = action?.icon;
  const timing = timeState(order, settings.kdsGreenMinutes, settings.kdsYellowMinutes);
  const canCancel = !['completed', 'cancelled'].includes(order.status);
  return (
    <article
      className={cn(
        'relative w-full max-w-[360px] rounded-[14px] border border-[#EAECF0] border-l-4 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(16,24,40,0.08)]',
        timing.className,
        highlighted && 'ring-2 ring-[var(--workspace-primary-border)]'
      )}
    >
      <button type="button" onClick={onDetails} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-black text-[#101828]">{order.displayNumber}</p>
            <p className="mt-1 text-xs font-bold text-[#667085]">{formatTime(orderStartTime(order))}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-[#101828]">{timing.elapsed} min</p>
            <p className={cn(
              'mt-0.5 text-xs font-black',
              timing.tone === 'danger' ? 'text-[#D92D20]' : timing.tone === 'warning' ? 'text-[#F79009]' : timing.tone === 'success' ? 'text-[#12B76A]' : 'text-[#667085]'
            )}>
              {timing.label}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{orderTypeShort(order)}</Badge>
          <Badge variant={order.status === 'ready' ? 'success' : order.status === 'cancelled' ? 'destructive' : 'default'}>{statusLabel(order)}</Badge>
        </div>

        <div className="mt-4">
          <p className="truncate text-base font-black text-[#101828]">{order.customerName || 'Cliente'}</p>
          {order.customerPhone ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[#667085]">
              <Phone className="h-3.5 w-3.5" />
              {order.customerPhone}
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-1.5">
          {(order.items ?? []).slice(0, 3).map((item) => (
            <p key={item.id} className="truncate text-sm font-medium text-[#101828]">{item.quantity}x {item.productName}</p>
          ))}
          {(order.items ?? []).length > 3 ? <p className="text-sm font-black text-[#667085]">+{(order.items ?? []).length - 3} produtos</p> : null}
        </div>
      </button>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#EAECF0] pt-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#101828]">{formatKz(order.total)}</p>
          <p className="truncate text-xs font-bold text-[#667085]">{paymentLabel(order.paymentMethod)}</p>
        </div>
        <div className="flex items-center gap-2">
          {action && ActionIcon ? (
            <Button type="button" size="sm" className="min-h-10 rounded-[10px]" disabled={busy} onClick={() => onAdvance(action.status)}>
              <ActionIcon className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          ) : null}
          <button type="button" onClick={onMenu} className="relative min-h-10 rounded-[10px] border border-[#EAECF0] px-2 text-[#667085] hover:bg-[#F7F8FA]">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="absolute bottom-14 right-4 z-10 w-40 rounded-[10px] border border-[#EAECF0] bg-white p-1 shadow-lg">
          <button type="button" onClick={onDetails} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-[#101828] hover:bg-[#F7F8FA]">Detalhes</button>
          {canCancel ? (
            <button type="button" onClick={onCancel} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-[#D92D20] hover:bg-red-50">Cancelar</button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function OrderDetailDrawer({ order, onClose }: { order: FoodOrder | null; onClose: () => void }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fechar detalhes" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#EAECF0] p-5">
          <div>
            <p className="text-2xl font-black text-[#101828]">{order.displayNumber}</p>
            <p className="mt-1 text-sm font-bold text-[#667085]">{order.statusLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[10px] border border-[#EAECF0] p-2 text-[#667085] hover:bg-[#F7F8FA]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <section>
            <p className="text-sm font-black text-[#101828]">Cliente</p>
            <p className="mt-2 text-sm text-[#667085]">{order.customerName || 'Cliente sem nome'}</p>
            {order.customerPhone ? <p className="text-sm text-[#667085]">{order.customerPhone}</p> : null}
            {order.deliveryAddress || order.deliveryNeighborhood ? <p className="mt-2 text-sm text-[#667085]">{[order.deliveryNeighborhood, order.deliveryAddress, order.deliveryReference].filter(Boolean).join(', ')}</p> : null}
          </section>
          <section>
            <p className="text-sm font-black text-[#101828]">Produtos</p>
            <div className="mt-2 space-y-3">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="rounded-[10px] border border-[#EAECF0] p-3">
                  <div className="flex justify-between gap-3 text-sm">
                    <strong className="text-[#101828]">{item.quantity}x {item.productName}</strong>
                    <strong className="text-[#101828]">{formatKz(item.subtotal)}</strong>
                  </div>
                  {(item.modifiers ?? []).length > 0 ? (
                    <p className="mt-1 text-xs text-[#667085]">{(item.modifiers ?? []).map((modifier) => modifier.optionName).join(', ')}</p>
                  ) : null}
                  {item.notes ? <p className="mt-1 text-xs font-medium text-[#F79009]">{item.notes}</p> : null}
                </div>
              ))}
            </div>
          </section>
          {order.notes ? (
            <section>
              <p className="text-sm font-black text-[#101828]">Observações</p>
              <p className="mt-2 rounded-[10px] bg-[#FFFAEB] p-3 text-sm text-[#92400E]">{order.notes}</p>
            </section>
          ) : null}
          <section>
            <p className="text-sm font-black text-[#101828]">Pagamento</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-[#667085]">Subtotal</span><strong>{formatKz(order.subtotal)}</strong></div>
              <div className="flex justify-between"><span className="text-[#667085]">Entrega</span><strong>{formatKz(order.deliveryFee)}</strong></div>
              <div className="flex justify-between text-lg"><span className="font-black text-[#101828]">Total</span><strong className="text-[#101828]">{formatKz(order.total)}</strong></div>
              <p className="text-sm font-bold text-[#667085]">{paymentLabel(order.paymentMethod)}</p>
            </div>
          </section>
          <section>
            <p className="text-sm font-black text-[#101828]">Histórico</p>
            <div className="mt-2 space-y-2">
              {(order.statusHistory ?? []).map((entry) => (
                <div key={entry.id} className="rounded-[10px] bg-[#F7F8FA] px-3 py-2 text-sm">
                  <p className="font-bold text-[#101828]">{entry.newStatusLabel || entry.newStatus}</p>
                  <p className="text-xs text-[#667085]">{formatTime(entry.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function FoodOrdersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedOrderId = searchParams.get('pedido');
  const [mainTab, setMainTab] = useState<MainTab>('active');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('completed');
  const [search, setSearch] = useState('');
  const [cancelOrder, setCancelOrder] = useState<FoodOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<FoodOrder | null>(null);
  const [menuOrderId, setMenuOrderId] = useState<string | null>(null);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'active' || requestedTab === 'history') setMainTab(requestedTab);
  }, [searchParams]);

  const selectMainTab = (tab: MainTab) => {
    setMainTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/food/pedidos?${params.toString()}`, { scroll: false });
  };

  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings, retry: 2 });
  const settings = settingsQuery.data;
  const enabled = settings?.isEnabled === true;
  const ordersQuery = useQuery({
    queryKey: ['food-v1-orders'],
    queryFn: () => getFoodV1Orders({ limit: 100 }),
    retry: 2,
    enabled,
    refetchInterval: 20_000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ order, status, cancelReason: reason }: { order: FoodOrder; status: FoodOrderStatus; cancelReason?: string | null }) => {
      if (status === 'sent_to_kitchen') return executeFoodOrderCommand(order.id, 'send_to_kitchen', { expectedVersion: order.version });
      if (status === 'completed') return executeFoodOrderCommand(order.id, 'complete', { expectedVersion: order.version });
      if (status === 'cancelled') return executeFoodOrderCommand(order.id, 'cancel', { expectedVersion: order.version, reason: reason || null });
      throw new Error('Esta transição deve ser executada no ambiente operacional correspondente.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-v1-orders'] });
      queryClient.invalidateQueries({ queryKey: ['food-overview'] });
      setCancelOrder(null);
      setCancelReason('');
      setMenuOrderId(null);
    },
  });

  const normalizedSearch = search.trim().toLowerCase();
  const allOrders = (ordersQuery.data ?? []).filter((order) => !normalizedSearch || [order.displayNumber, order.customerName, order.customerPhone].some((value) => String(value || '').toLowerCase().includes(normalizedSearch)));
  const activeOrders = allOrders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const historyOrders = allOrders.filter((order) => order.status === historyFilter);
  const activeCounts = useMemo(() => ({
    all: activeOrders.length,
    kitchen: activeOrders.filter((order) => KITCHEN_STATUSES.includes(order.status)).length,
    ready: activeOrders.filter((order) => READY_STATUSES.includes(order.status)).length,
    delivery: activeOrders.filter((order) => DELIVERY_STATUSES.includes(order.status)).length,
  }), [activeOrders]);
  const historyCounts = useMemo(() => ({
    completed: allOrders.filter((order) => order.status === 'completed').length,
    cancelled: allOrders.filter((order) => order.status === 'cancelled').length,
  }), [allOrders]);

  const visibleActiveOrders = useMemo(() => {
    return activeOrders
      .filter((order) => matchesActiveFilter(order, activeFilter))
      .sort((a, b) => {
        const aTime = timeState(a, settings?.kdsGreenMinutes, settings?.kdsYellowMinutes);
        const bTime = timeState(b, settings?.kdsGreenMinutes, settings?.kdsYellowMinutes);
        const rank = { danger: 0, warning: 1, success: 2, neutral: 3 };
        if (rank[aTime.tone] !== rank[bTime.tone]) return rank[aTime.tone] - rank[bTime.tone];
        return new Date(orderStartTime(a)).getTime() - new Date(orderStartTime(b)).getTime();
      });
  }, [activeFilter, activeOrders, settings?.kdsGreenMinutes, settings?.kdsYellowMinutes]);

  if (settingsQuery.isLoading) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><div className="h-64 animate-pulse rounded-[14px] bg-white" /></div>;
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <ErrorState title="KukuGest Food ainda não está activo" message="Active o módulo em Configurações para acompanhar pedidos." />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F7F8FA] p-4 md:p-5" style={getFoodBrandStyle(settings)}>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-[var(--workspace-primary)]">Operação Food</p>
            <h1 className="mt-1 text-2xl font-black tracking-normal text-[#101828]">{mainTab === 'active' ? 'Pedidos de hoje' : 'Histórico de pedidos'}</h1>
          </div>
          <Button asChild className="min-h-11 rounded-[10px]">
            <Link href="/food/novo-pedido">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Novo pedido
            </Link>
          </Button>
        </header>

        {updateStatusMutation.isError ? (
          <ErrorState compact title="Não foi possível actualizar o pedido" message={getApiErrorMessage(updateStatusMutation.error, 'Tente novamente.')} />
        ) : null}

        <div className="inline-flex rounded-[12px] border border-[#EAECF0] bg-white p-1 shadow-sm">
          {(['active', 'history'] as MainTab[]).map((tab) => {
            const active = mainTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => selectMainTab(tab)}
                className={cn(
                  'min-h-10 rounded-[10px] px-4 text-sm font-black',
                  active ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]' : 'text-[#667085] hover:bg-[#F7F8FA]'
                )}
              >
                {tab === 'active' ? 'Em curso' : 'Histórico'}
              </button>
            );
          })}
        </div>

        {mainTab === 'active' ? (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-full gap-2 overflow-x-auto">
                {ACTIVE_FILTERS.map((filter) => {
                  const active = activeFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setActiveFilter(filter.value)}
                      className={cn(
                        'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black',
                        active ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]' : 'border-[#EAECF0] bg-white text-[#667085]'
                      )}
                    >
                      {filter.label}
                      <span>{activeCounts[filter.value]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número, cliente ou telefone" className="min-h-11 rounded-[10px] border-[#EAECF0] bg-white pl-9" />
              </div>
            </div>

            {ordersQuery.isError ? (
              <ErrorState title="Não foi possível carregar pedidos" message={getApiErrorMessage(ordersQuery.error, 'Tente novamente.')} onRetry={() => ordersQuery.refetch()} />
            ) : null}

            {ordersQuery.isLoading ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,360px))] gap-4">
                {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-[14px] bg-white" />)}
              </div>
            ) : visibleActiveOrders.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-[14px] border border-dashed border-[#EAECF0] bg-white text-center">
                <Clock3 className="h-9 w-9 text-[#98A2B3]" />
                <p className="mt-3 text-base font-black text-[#101828]">Sem pedidos activos</p>
                <Button asChild className="mt-4 rounded-[10px]">
                  <Link href="/food/novo-pedido">Criar pedido</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,360px))] gap-4">
                {visibleActiveOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    highlighted={order.id === highlightedOrderId}
                    busy={updateStatusMutation.isPending}
                    settings={{ kdsGreenMinutes: settings?.kdsGreenMinutes, kdsYellowMinutes: settings?.kdsYellowMinutes }}
                    menuOpen={menuOrderId === order.id}
                    onMenu={() => setMenuOrderId((current) => current === order.id ? null : order.id)}
                    onDetails={() => { setSelectedOrder(order); setMenuOrderId(null); }}
                    onAdvance={(status) => updateStatusMutation.mutate({ order, status })}
                    onCancel={() => { setCancelOrder(order); setCancelReason(''); setMenuOrderId(null); }}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex w-fit rounded-[12px] border border-[#EAECF0] bg-white p-1 shadow-sm">
                {HISTORY_FILTERS.map((filter) => {
                  const active = historyFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setHistoryFilter(filter.value)}
                      className={cn(
                        'inline-flex min-h-10 items-center gap-2 rounded-[10px] px-4 text-sm font-black',
                        active ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]' : 'text-[#667085] hover:bg-[#F7F8FA]'
                      )}
                    >
                      {filter.label}
                      <span>{historyCounts[filter.value]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número, cliente ou telefone" className="min-h-11 rounded-[10px] border-[#EAECF0] bg-white pl-9" />
              </div>
            </div>

            <div className="overflow-hidden rounded-[14px] border border-[#EAECF0] bg-white shadow-sm">
              {historyOrders.length === 0 ? (
                <div className="p-8 text-center text-sm font-bold text-[#667085]">Sem registos.</div>
              ) : historyOrders.map((order) => (
                <button key={order.id} type="button" onClick={() => setSelectedOrder(order)} className="grid w-full grid-cols-1 gap-2 border-b border-[#EAECF0] px-4 py-3 text-left last:border-b-0 md:grid-cols-[100px_minmax(0,1fr)_140px_140px] md:items-center">
                  <span className="font-black text-[#101828]">{order.displayNumber}</span>
                  <span className="min-w-0 truncate text-sm font-bold text-[#101828]">{order.customerName || 'Cliente'}</span>
                  <span className="text-sm font-bold text-[#667085]">{statusLabel(order)}</span>
                  <span className="text-sm font-black text-[#101828] md:text-right">{formatKz(order.total)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <OrderDetailDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />

      <Dialog open={!!cancelOrder} onOpenChange={(open) => !open && setCancelOrder(null)}>
        <DialogContent className="max-w-lg rounded-[14px]">
          <DialogHeader>
            <DialogTitle>Cancelar {cancelOrder?.displayNumber}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motivo</Label>
            <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Produto indisponível, cliente desistiu..." rows={4} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOrder(null)}>Voltar</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!cancelReason.trim() || updateStatusMutation.isPending || !cancelOrder}
              onClick={() => cancelOrder && updateStatusMutation.mutate({ order: cancelOrder, status: 'cancelled', cancelReason })}
            >
              Cancelar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
