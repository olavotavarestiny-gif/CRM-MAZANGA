'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Check, ChefHat, CircleAlert, Clock3, Maximize2, Minimize2, PackageCheck, StickyNote, Volume2, VolumeX } from 'lucide-react';
import {
  acknowledgeFoodKitchenTicket,
  executeFoodOrderCommand,
  getFoodKitchenTickets,
  getFoodSettings,
  updateFoodKitchenItem,
} from '@/lib/api';
import type { FoodKitchenTicket, FoodKitchenTicketItem } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { useFoodRealtime } from '@/hooks/use-food-realtime';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Textarea } from '@/components/ui/textarea';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { cn } from '@/lib/utils';
import { enableKitchenAudio, playKitchenAlert } from '@/lib/food-kitchen-audio';

const COLUMNS: Array<{ id: 'new' | 'preparing' | 'ready'; states: FoodKitchenTicket['state'][]; title: string; description: string; icon: typeof ChefHat }> = [
  { id: 'new', states: ['queued', 'accepted'], title: 'Novos', description: 'Aguardam início', icon: BellRing },
  { id: 'preparing', states: ['preparing'], title: 'Em preparação', description: 'Produção em curso', icon: ChefHat },
  { id: 'ready', states: ['ready'], title: 'Prontos', description: 'Aguardam saída', icon: PackageCheck },
];

function elapsed(start: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(start).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function urgency(ticket: FoodKitchenTicket, now: number, thresholds: { green: number; yellow: number; red: number }) {
  const alert = ticket.alert;
  if (alert) {
    const styles = {
      new: { card: 'border-l-sky-400', badge: 'bg-sky-50 text-sky-700' },
      change: { card: 'border-l-sky-400', badge: 'bg-sky-50 text-sky-700' },
      unaccepted_warning: { card: 'border-l-amber-400', badge: 'bg-amber-50 text-amber-700' },
      cashier_escalation: { card: 'border-l-red-500', badge: 'bg-red-50 text-red-700' },
      near_limit: { card: 'border-l-amber-300', badge: 'bg-amber-50 text-amber-700' },
      late: { card: 'border-l-red-400', badge: 'bg-red-50 text-red-700' },
      critical: { card: 'border-l-red-600', badge: 'bg-red-50 text-red-700' },
      ready_waiting: { card: 'border-l-violet-400', badge: 'bg-violet-50 text-violet-700' },
      acknowledged: { card: 'border-l-emerald-300', badge: 'bg-emerald-50 text-emerald-700' },
      on_time: { card: 'border-l-emerald-300', badge: 'bg-emerald-50 text-emerald-700' },
    }[alert.level];
    return { ...styles, label: alert.label };
  }
  const minutes = (now - new Date(ticket.createdAt).getTime()) / 60_000;
  if (minutes >= thresholds.red) return { card: 'border-l-red-600', badge: 'bg-red-50 text-red-700', label: 'Muito atrasado' };
  if (minutes >= thresholds.yellow) return { card: 'border-l-red-400', badge: 'bg-red-50 text-red-700', label: 'Atrasado' };
  if (minutes >= thresholds.green) return { card: 'border-l-amber-400', badge: 'bg-amber-50 text-amber-700', label: 'Atenção' };
  return { card: 'border-l-emerald-300', badge: 'bg-emerald-50 text-emerald-700', label: 'No tempo' };
}

function nextCommand(ticket: FoodKitchenTicket) {
  if (ticket.state === 'queued') return { command: 'kitchen_accept' as const, label: 'Aceitar pedido' };
  if (ticket.state === 'accepted') return { command: 'kitchen_start' as const, label: 'Começar preparo' };
  if (ticket.state === 'preparing') return { command: 'kitchen_ready' as const, label: 'Marcar como pronto' };
  return null;
}

export default function FoodKitchenPage() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [sound, setSound] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [issue, setIssue] = useState<{ ticket: FoodKitchenTicket; item: FoodKitchenTicketItem } | null>(null);
  const [issueNote, setIssueNote] = useState('');
  const kitchenPanelRef = useRef<HTMLDivElement>(null);
  const soundInitialized = useRef(false);
  const lastPlayed = useRef(new Map<string, { level: string; at: number }>());
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const ticketsQuery = useQuery({
    queryKey: ['food-kitchen-tickets'],
    queryFn: () => getFoodKitchenTickets({ states: ['queued', 'accepted', 'preparing', 'ready'] }),
    refetchInterval: 3_000,
  });
  const onRealtimeEvent = useCallback((event: { eventType: string }) => {
    if (!sound || settingsQuery.data?.kitchenSoundEnabled === false) return;
    if (!['kitchen.item_updated', 'kitchen.issue_resolved'].includes(event.eventType)) return;
    void playKitchenAlert('change', Number(settingsQuery.data?.kitchenSoundVolume ?? 0.7)).then((played) => setAudioBlocked(!played));
  }, [settingsQuery.data?.kitchenSoundEnabled, settingsQuery.data?.kitchenSoundVolume, sound]);
  useFoodRealtime(true, onRealtimeEvent);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (soundInitialized.current || !settingsQuery.data) return;
    setSound(settingsQuery.data.kitchenSoundEnabled);
    soundInitialized.current = true;
  }, [settingsQuery.data]);
  useEffect(() => {
    if (!sound || settingsQuery.data?.kitchenSoundEnabled === false) return;
    const repeatMs = Number(settingsQuery.data?.kitchenSoundRepeatSeconds || 20) * 1000;
    const candidates = (ticketsQuery.data ?? []).filter((ticket) => ticket.alert?.audible);
    const priority = ['cashier_escalation', 'critical', 'unaccepted_warning', 'late', 'ready_waiting', 'new', 'near_limit'];
    candidates.sort((a, b) => priority.indexOf(a.alert!.level) - priority.indexOf(b.alert!.level));
    const candidate = candidates.find((ticket) => {
      const previous = lastPlayed.current.get(ticket.id);
      return !previous || previous.level !== ticket.alert!.level || now - previous.at >= repeatMs;
    });
    if (!candidate?.alert) return;
    lastPlayed.current.set(candidate.id, { level: candidate.alert.level, at: now });
    void playKitchenAlert(candidate.alert.level, Number(settingsQuery.data?.kitchenSoundVolume ?? 0.7)).then((played) => setAudioBlocked(!played));
  }, [now, settingsQuery.data, sound, ticketsQuery.data]);
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const refreshKitchen = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['food-kitchen-tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['food-v1-orders'] }),
    ]);
  };
  const commandMutation = useMutation({
    mutationFn: ({ ticket, command }: { ticket: FoodKitchenTicket; command: 'kitchen_accept' | 'kitchen_start' | 'kitchen_ready' }) => executeFoodOrderCommand(ticket.orderId, command, { expectedVersion: ticket.order?.version }),
    onSuccess: refreshKitchen,
  });
  const acknowledgeMutation = useMutation({
    mutationFn: (ticket: FoodKitchenTicket) => acknowledgeFoodKitchenTicket(ticket.id, ticket.version),
    onSuccess: refreshKitchen,
  });
  const itemMutation = useMutation({
    mutationFn: ({ ticket, item, state, note }: { ticket: FoodKitchenTicket; item: FoodKitchenTicketItem; state: FoodKitchenTicketItem['state']; note?: string }) => updateFoodKitchenItem(ticket.id, item.id, { state, issueType: state === 'unavailable' ? 'product_unavailable' : undefined, issueNote: note }),
    onSuccess: async () => {
      setIssue(null);
      setIssueNote('');
      await refreshKitchen();
    },
  });

  const grouped = useMemo(() => new Map(COLUMNS.map((column) => [column.id, (ticketsQuery.data ?? []).filter((ticket) => column.states.includes(ticket.state))])), [ticketsQuery.data]);
  const thresholds = {
    green: Number(settingsQuery.data?.kdsGreenMinutes || 15),
    yellow: Number(settingsQuery.data?.kdsYellowMinutes || 25),
    red: Number(settingsQuery.data?.kdsRedMinutes || 35),
  };
  const toggleFullscreen = async () => {
    if (fullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen();
      setFullscreen(false);
      return;
    }
    setFullscreen(true);
    try {
      await kitchenPanelRef.current?.requestFullscreen?.();
    } catch {
      // O modo foco em CSS mantém o KDS isolado quando o browser não oferece fullscreen nativo.
    }
  };
  const activateSound = async () => {
    setSound(true);
    const played = await enableKitchenAudio(Number(settingsQuery.data?.kitchenSoundVolume ?? 0.7));
    setAudioBlocked(!played);
  };

  if (ticketsQuery.isError) {
    return <div className="p-4 md:p-6"><ErrorState title="Não foi possível ligar à cozinha" message={getApiErrorMessage(ticketsQuery.error, 'Verifique a base de dados e volte a tentar.')} onRetry={() => ticketsQuery.refetch()} /></div>;
  }

  return (
    <div ref={kitchenPanelRef} className={cn('min-h-full space-y-5 bg-slate-50 p-3 md:p-5', fullscreen && 'fixed inset-0 z-[100] h-dvh overflow-y-auto p-4 md:p-5')} style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="KukuGest Cozinha" title="Produção" description="Pedidos por preparar, em preparo e prontos para sair.">
        <Button variant="secondary" size="icon" title={sound ? 'Desligar som' : 'Ligar som'} aria-label={sound ? 'Desligar som' : 'Ligar som'} onClick={() => { if (sound) { setSound(false); setAudioBlocked(false); } else void activateSound(); }}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>
        <Button variant="secondary" size="icon" title="Ecrã inteiro" aria-label="Ecrã inteiro" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
      </FoodPageHeader>

      {sound && audioBlocked ? <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><VolumeX className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-black">O navegador bloqueou o som</p><p className="text-xs font-medium text-amber-800">Os alertas visuais continuam activos.</p></div></div><Button size="sm" variant="outline" onClick={() => void activateSound()}><Volume2 className="mr-2 h-4 w-4" />Ativar som</Button></div> : null}

      {ticketsQuery.isLoading ? <div className="h-72 animate-pulse rounded-lg bg-white" /> : (ticketsQuery.data ?? []).length === 0 ? (
        <FoodEmptyState icon={ChefHat} title="Cozinha livre" description="Os pedidos enviados pelo caixa aparecem aqui automaticamente." />
      ) : (
        <div className="grid min-h-[65vh] grid-cols-1 gap-3 xl:grid-cols-3">
          {COLUMNS.map((column) => {
            const tickets = grouped.get(column.id) ?? [];
            const ColumnIcon = column.icon;
            return (
              <section key={column.id} className="min-w-0 rounded-lg bg-slate-100/70 p-2.5">
                <div className="flex items-center justify-between gap-3 px-1.5 py-1.5"><div className="flex items-center gap-2"><ColumnIcon className="h-4 w-4 text-slate-500" /><div><h2 className="text-sm font-bold text-slate-900">{column.title}</h2><p className="text-xs text-slate-500">{column.description}</p></div></div><Badge className="border-0 bg-white text-slate-600">{tickets.length}</Badge></div>
                <div className="mt-2 space-y-3">
                  {tickets.length === 0 ? <p className="rounded-md border border-dashed border-slate-200 bg-white/60 px-3 py-8 text-center text-sm text-slate-400">Sem pedidos</p> : null}
                  {tickets.map((ticket) => {
                    const order = ticket.order;
                    const timer = urgency(ticket, now, thresholds);
                    const action = nextCommand(ticket);
                    return (
                      <Card key={ticket.id} className={cn('overflow-hidden border border-l-4 border-slate-200 bg-white shadow-none', timer.card)}>
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4"><div><p className="text-xl font-bold text-slate-950">{order?.displayNumber || `#${ticket.orderId.slice(-4)}`}</p><p className="mt-1 text-xs font-medium text-slate-500">{order?.orderTypeLabel || order?.orderType}{ticket.branch?.name ? ` · ${ticket.branch.name}` : ''}</p></div><div className="text-right"><div className={cn('inline-flex min-w-[76px] items-center justify-center gap-1 rounded-md px-2 py-1.5 font-mono text-sm font-bold', timer.badge)}><Clock3 className="h-3.5 w-3.5" />{elapsed(ticket.createdAt, now)}</div><p className="mt-1 text-[11px] font-semibold text-slate-500">{timer.label}</p></div></div>
                        <div className="p-4">
                          <div className="divide-y divide-slate-100">
                          {(ticket.items ?? []).map((item) => {
                            const orderItem = item.orderItem;
                            return (
                              <div key={item.id} className={cn('py-3 first:pt-0 last:pb-0', item.state === 'completed' && 'opacity-55')}>
                                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className={cn('text-sm font-bold text-slate-950', item.state === 'completed' && 'line-through')}><span className="mr-1 text-[var(--workspace-primary)]">{orderItem?.quantity}x</span>{orderItem?.productName}</p>{(orderItem?.modifiers ?? []).map((modifier) => <p key={modifier.id} className="mt-0.5 text-xs font-medium text-slate-500">+ {modifier.optionName}</p>)}{orderItem?.notes ? <p className="mt-2 border-l-2 border-amber-300 pl-2 text-xs font-semibold text-amber-900"><StickyNote className="mr-1 inline h-3 w-3" />{orderItem.notes}</p> : null}{item.issueNote ? <p className="mt-2 text-xs font-semibold text-red-700"><CircleAlert className="mr-1 inline h-3 w-3" />{item.issueNote}</p> : null}</div>
                                  {ticket.state === 'preparing' && !['completed', 'unavailable'].includes(item.state) ? <div className="flex shrink-0 gap-1"><Button size="icon" variant="outline" title="Item indisponível" aria-label="Item indisponível" onClick={() => setIssue({ ticket, item })}><CircleAlert className="h-4 w-4 text-red-600" /></Button><Button size="icon" title="Concluir item" aria-label="Concluir item" disabled={itemMutation.isPending} onClick={() => itemMutation.mutate({ ticket, item, state: 'completed' })}><Check className="h-4 w-4" /></Button></div> : null}
                                </div>
                              </div>
                            );
                          })}
                          </div>
                          {order?.notes ? <p className="mt-3 border-l-2 border-amber-300 bg-amber-50/60 px-3 py-2 text-xs font-semibold text-amber-950"><StickyNote className="mr-1 inline h-3.5 w-3.5" />{order.notes}</p> : null}
                          <div className="mt-4">
                            {ticket.state === 'queued' && !ticket.acknowledgedAt ? <Button className="w-full" disabled={acknowledgeMutation.isPending} onClick={() => acknowledgeMutation.mutate(ticket)}><BellRing className="mr-2 h-4 w-4" />Reconhecer pedido</Button> : null}
                            {action && !(ticket.state === 'queued' && !ticket.acknowledgedAt) ? <Button className="w-full" disabled={commandMutation.isPending} onClick={() => commandMutation.mutate({ ticket, command: action.command })}>{action.label}</Button> : null}
                            {!action ? <div className="flex items-center justify-center gap-2 rounded-md bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700"><PackageCheck className="h-4 w-4" />Pedido pronto</div> : null}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {(commandMutation.isError || acknowledgeMutation.isError || itemMutation.isError) ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(commandMutation.error || acknowledgeMutation.error || itemMutation.error)}</p> : null}

      {issue ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setIssue(null); }}>
          <Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h2 className="text-lg font-black text-slate-950">Produto indisponível</h2><p className="mt-1 text-sm text-slate-500">Indique o problema para o caixa tratar a alteração com o cliente.</p><Textarea className="mt-4" rows={4} value={issueNote} onChange={(event) => setIssueNote(event.target.value)} placeholder="Ex.: ingrediente em falta" /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setIssue(null)}>Cancelar</Button><Button variant="destructive" disabled={!issueNote.trim() || itemMutation.isPending} onClick={() => itemMutation.mutate({ ...issue, state: 'unavailable', note: issueNote })}>Registar problema</Button></div></Card>
        </div>
      ) : null}
    </div>
  );
}
