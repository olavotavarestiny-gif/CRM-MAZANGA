'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Clock3, History, Plus, Receipt, ShoppingBag, Tag } from 'lucide-react';
import {
  createFoodCustomerOccurrence,
  getFoodContext,
  getFoodCustomerTimeline,
  resolveFoodCustomerOccurrence,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import type {
  FoodCustomerOccurrenceSeverity,
  FoodCustomerOccurrenceType,
  FoodCustomerTimelineEvent,
  FoodCustomerTimelineType,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const filters: Array<{ value: FoodCustomerTimelineType; label: string }> = [
  { value: 'all', label: 'Tudo' },
  { value: 'order', label: 'Pedidos' },
  { value: 'coupon', label: 'Cupões' },
  { value: 'occurrence', label: 'Ocorrências' },
  { value: 'audit', label: 'Alterações' },
];

const occurrenceLabels: Record<FoodCustomerOccurrenceType, string> = {
  complaint: 'Reclamação',
  compliment: 'Elogio',
  preference: 'Preferência',
  incident: 'Incidente',
  follow_up: 'Acompanhamento',
  other: 'Outro',
};

const severityLabels: Record<FoodCustomerOccurrenceSeverity, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const auditLabels: Record<string, string> = {
  'customer.saved': 'Cliente criado',
  'customer.updated': 'Dados do cliente actualizados',
  'customer.profile.updated': 'Perfil Food actualizado',
  'customer.archived': 'Cliente arquivado',
  'customer.occurrence.created': 'Ocorrência registada',
  'customer.occurrence.resolved': 'Ocorrência resolvida',
};

const emptyForm = {
  branchId: '',
  type: 'complaint' as FoodCustomerOccurrenceType,
  severity: 'medium' as FoodCustomerOccurrenceSeverity,
  title: '',
  description: '',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(amount)} Kz` : null;
}

function eventIcon(type: FoodCustomerTimelineEvent['type']) {
  if (type === 'order') return ShoppingBag;
  if (type === 'coupon') return Tag;
  if (type === 'occurrence') return AlertCircle;
  return History;
}

export function FoodCustomerTimeline({ contactId }: { contactId: number }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FoodCustomerTimelineType>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const timelineQuery = useQuery({
    queryKey: ['food-customer-timeline', contactId, filter],
    queryFn: () => getFoodCustomerTimeline(contactId, filter),
  });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['food-customer-timeline', contactId] });
  const createMutation = useMutation({
    mutationFn: () => createFoodCustomerOccurrence(contactId, { ...form, branchId: form.branchId || null }),
    onSuccess: async () => {
      setForm(emptyForm);
      setShowForm(false);
      await refresh();
    },
  });
  const resolveMutation = useMutation({
    mutationFn: ({ occurrenceId, note }: { occurrenceId: string; note: string }) => resolveFoodCustomerOccurrence(contactId, occurrenceId, note),
    onSuccess: async () => {
      setResolvingId(null);
      setResolutionNote('');
      await refresh();
    },
  });
  const error = timelineQuery.error || createMutation.error || resolveMutation.error;

  return (
    <section className="space-y-3 border-y border-slate-200 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-950">Actividade do cliente</h3>
          <p className="text-xs text-slate-500">Pedidos, benefícios, ocorrências e alterações relevantes.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((value) => !value)}>
          <Plus className="mr-2 h-4 w-4" />Ocorrência
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Filtrar actividade">
        {filters.map((item) => (
          <Button key={item.value} type="button" size="sm" variant={filter === item.value ? 'default' : 'ghost'} className="shrink-0" onClick={() => setFilter(item.value)}>
            {item.label}
          </Button>
        ))}
      </div>

      {showForm ? (
        <div className="grid grid-cols-1 gap-3 border-l-4 border-[var(--workspace-primary)] bg-slate-50 p-4 sm:grid-cols-2">
          <div><Label>Tipo</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FoodCustomerOccurrenceType })}>{Object.entries(occurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div><Label>Prioridade</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as FoodCustomerOccurrenceSeverity })}>{Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="sm:col-span-2"><Label>Título *</Label><Input className="mt-1 bg-white" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Descrição</Label><Textarea className="mt-1 bg-white" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
          <div><Label>Unidade</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}><option value="">Sem unidade</option>{(contextQuery.data?.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
          <div className="flex items-end justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancelar</Button><Button type="button" size="sm" disabled={!form.title.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? 'A registar...' : 'Registar'}</Button></div>
        </div>
      ) : null}

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(error)}</p> : null}
      {timelineQuery.isLoading ? <div className="h-32 animate-pulse rounded-md bg-slate-100" /> : null}
      {!timelineQuery.isLoading && !timelineQuery.data?.length ? <div className="border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Sem actividade neste filtro.</div> : null}

      <div className="divide-y divide-slate-200 border-y border-slate-200">
        {(timelineQuery.data || []).map((event) => {
          const Icon = eventIcon(event.type);
          const orderTotal = event.type === 'order' ? formatMoney(event.metadata.total) : null;
          const discount = event.type === 'coupon' ? formatMoney(event.metadata.discountAmount) : null;
          const isOpenOccurrence = event.type === 'occurrence' && event.status === 'open' && event.entityId;
          return (
            <div key={event.id} className="py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-700"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="text-sm font-bold text-slate-950">{event.type === 'audit' ? auditLabels[event.title] || event.title : event.title}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(event.occurredAt)}{event.branch?.name ? ` · ${event.branch.name}` : ''}</p></div>
                    <div className="flex items-center gap-2">{event.severity ? <span className={`rounded px-2 py-0.5 text-xs font-bold ${event.severity === 'high' ? 'bg-red-50 text-red-700' : event.severity === 'low' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{severityLabels[event.severity]}</span> : null}{orderTotal ? <strong className="text-sm text-slate-950">{orderTotal}</strong> : null}{discount ? <strong className="text-sm text-emerald-700">-{discount}</strong> : null}</div>
                  </div>
                  {event.description ? <p className="mt-2 text-sm text-slate-700">{event.description}</p> : null}
                  {event.resolutionNote ? <p className="mt-2 flex gap-2 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Check className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Resolução:</strong> {event.resolutionNote}</span></p> : null}
                  {isOpenOccurrence && resolvingId !== event.entityId ? <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => { setResolvingId(event.entityId as string); setResolutionNote(''); }}><Clock3 className="mr-2 h-4 w-4" />Resolver</Button> : null}
                  {isOpenOccurrence && resolvingId === event.entityId ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={resolutionNote} onChange={(inputEvent) => setResolutionNote(inputEvent.target.value)} placeholder="Como foi resolvida?" /><Button type="button" size="sm" disabled={resolutionNote.trim().length < 3 || resolveMutation.isPending} onClick={() => resolveMutation.mutate({ occurrenceId: event.entityId as string, note: resolutionNote })}><Receipt className="mr-2 h-4 w-4" />Confirmar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setResolvingId(null)}>Cancelar</Button></div> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
