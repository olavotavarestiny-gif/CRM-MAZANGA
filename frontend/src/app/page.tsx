'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFacturas,
  getFaturacaoDashboard,
  getCurrentUser,
  getServicesDashboardBase,
  updateTask,
} from '@/lib/api';
import { isComercio } from '@/lib/business-modes';
import type { Factura, ServicesDashboardBase, Task } from '@/lib/types';
import PainelComercialPage from '@/components/comercial/painel-comercial';
import OnboardingChecklist from '@/components/onboarding/onboarding-checklist';
import StartupModelSelector from '@/components/onboarding/startup-model-selector';
import TaskFormModal from '@/components/tasks/task-form-modal';
import { BillingAccessBanner } from '@/components/billing/access-notice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast-provider';
import { cn } from '@/lib/utils';

type PeriodoDashboard = '7d' | 'month' | '90d';
type DashboardWidgetId =
  | 'receita'
  | 'pipeline'
  | 'clientes'
  | 'conversao'
  | 'facturas_atraso'
  | 'ticket_medio'
  | 'funil'
  | 'actividade'
  | 'tarefas'
  | 'facturas_pendentes';

interface ActivityItem {
  id: string;
  label: string;
  detail: string;
  time: string;
  tone: 'normal' | 'danger' | 'warning' | 'success';
}

const PERIOD_OPTIONS: Array<{ value: PeriodoDashboard; label: string }> = [
  { value: '7d', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: '90d', label: 'Trimestre' },
];

const WIDGET_OPTIONS: Array<{ id: DashboardWidgetId; label: string }> = [
  { id: 'receita', label: 'Receita' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'clientes', label: 'Clientes activos' },
  { id: 'conversao', label: 'Taxa conversão' },
  { id: 'facturas_atraso', label: 'Faturas pendentes' },
  { id: 'ticket_medio', label: 'Ticket médio' },
  { id: 'funil', label: 'Funil pipeline' },
  { id: 'actividade', label: 'Actividade recente' },
  { id: 'tarefas', label: 'Tarefas' },
  { id: 'facturas_pendentes', label: 'Faturas pendentes' },
];

const DEFAULT_WIDGET_VISIBILITY = WIDGET_OPTIONS.reduce(
  (acc, widget) => ({ ...acc, [widget.id]: true }),
  {} as Record<DashboardWidgetId, boolean>
);

function dashboardWidgetStorageKey(userId?: number | null) {
  return userId ? `kuku_dashboard_widgets_${userId}` : null;
}

function readWidgetVisibility(storageKey: string | null) {
  if (!storageKey || typeof window === 'undefined') return DEFAULT_WIDGET_VISIBILITY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Partial<Record<DashboardWidgetId, boolean>>;
    return WIDGET_OPTIONS.reduce(
      (acc, widget) => ({ ...acc, [widget.id]: parsed[widget.id] ?? true }),
      {} as Record<DashboardWidgetId, boolean>
    );
  } catch {
    return DEFAULT_WIDGET_VISIBILITY;
  }
}

function formatKz(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(Number(value || 0))} Kz`;
}

function formatShortKz(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const number = Number(value || 0);
  if (Math.abs(number) >= 1_000_000) {
    return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 1 }).format(number / 1_000_000)}M Kz`;
  }
  if (Math.abs(number) >= 1_000) {
    return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(number / 1_000)}k Kz`;
  }
  return formatKz(number);
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sem data';
  return parsed.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function formatRelative(value?: string | null) {
  if (!value) return 'agora';
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return 'agora';
  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function isOverdue(value?: string | null) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed < today;
}

function getDateRange(period: PeriodoDashboard) {
  const end = new Date();
  const start = new Date();
  if (period === 'month') {
    start.setDate(1);
  } else {
    start.setDate(start.getDate() - (period === '7d' ? 6 : 89));
  }
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="flex animate-pulse flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
          <div className="flex flex-col gap-3">
            <div className="h-8 w-56 rounded-lg bg-slate-200" />
            <div className="h-4 w-72 rounded-lg bg-slate-100" />
          </div>
          <div className="h-10 w-72 rounded-lg bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-32 rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-72 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function TopBar({
  userName,
  period,
  customizing,
  onPeriodChange,
  onToggleCustomizing,
}: {
  userName: string;
  period: PeriodoDashboard;
  customizing: boolean;
  onPeriodChange: (period: PeriodoDashboard) => void;
  onToggleCustomizing: () => void;
}) {
  const today = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm text-slate-500">Olá, {userName}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2c2f31]">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">{today}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPeriodChange(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                period === option.value
                  ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]'
                  : 'text-slate-500 hover:bg-[var(--workspace-primary-soft)] hover:text-[var(--workspace-primary)]'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Button variant={customizing ? 'default' : 'outline'} onClick={onToggleCustomizing}>
          Personalizar
        </Button>
      </div>
    </div>
  );
}

function WidgetPicker({
  visible,
  onToggle,
}: {
  visible: Record<DashboardWidgetId, boolean>;
  onToggle: (id: DashboardWidgetId) => void;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2">
          {WIDGET_OPTIONS.map((widget) => {
            const active = visible[widget.id];
            return (
              <button
                key={widget.id}
                type="button"
                onClick={() => onToggle(widget.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-[var(--workspace-primary-border)] hover:text-[var(--workspace-primary)]'
                )}
              >
                {widget.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  variation,
  danger,
}: {
  label: string;
  value: string;
  variation: string;
  danger?: boolean;
}) {
  return (
    <Card className={cn('border-slate-200 shadow-sm', danger && 'border-red-200 bg-red-50/40')}>
      <CardContent className="p-4">
        <p className={cn('text-xs font-medium uppercase tracking-wide text-slate-500', danger && 'text-red-700')}>
          {label}
        </p>
        <p className={cn('mt-4 text-2xl font-black tracking-tight text-[#2c2f31]', danger && 'text-red-700')}>
          {value}
        </p>
        <p className={cn('mt-2 text-xs text-slate-500', danger && 'text-red-600')}>{variation}</p>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-3 p-5 pb-2">
        <CardTitle className="text-base font-semibold text-[#2c2f31]">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="p-5 pt-3">{children}</CardContent>
    </Card>
  );
}

function PipelineFunnelCard({ data, accentColor }: { data: ServicesDashboardBase; accentColor: string }) {
  const stages = data.pipelineHealth?.byStage ?? [];
  const visibleStages = stages.length ? stages : [
    { stage: 'Prospecção', count: 0 },
    { stage: 'Proposta', count: 0 },
    { stage: 'Negociação', count: 0 },
    { stage: 'Fechado', count: data.kpis.wonCount ?? 0 },
  ];
  const max = Math.max(1, ...visibleStages.map((stage) => stage.count));

  return (
    <SectionCard title="Funil de pipeline">
      <div className="flex flex-col gap-4">
        {visibleStages.slice(0, 6).map((stage) => (
          <div key={stage.stage}>
            <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
              <span className="truncate font-medium text-[#2c2f31]">{stage.stage}</span>
              <span className="text-slate-500">{stage.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max(4, (stage.count / max) * 100)}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function buildTaskItems(data: ServicesDashboardBase) {
  const actions = data.nextActions;
  if (!actions) return [];
  return [
    ...actions.overdueTasks,
    ...actions.followUpsToday,
  ].filter((task) => !task.done).slice(0, 5);
}

function TasksCard({
  data,
  completingTaskId,
  onComplete,
  onCreate,
}: {
  data: ServicesDashboardBase;
  completingTaskId: number | null;
  onComplete: (taskId: number) => void;
  onCreate: () => void;
}) {
  const tasks = buildTaskItems(data);

  return (
    <SectionCard
      title="Tarefas"
      action={<Button size="sm" variant="outline" onClick={onCreate}>+ Nova</Button>}
    >
      {tasks.length ? (
        <div className="flex flex-col divide-y divide-slate-100">
          {tasks.map((task) => {
            const overdue = isOverdue(task.dueDate);
            return (
              <div key={task.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Checkbox
                  checked={task.done}
                  disabled={completingTaskId === task.id}
                  onCheckedChange={() => onComplete(task.id)}
                  aria-label={`Concluir ${task.title}`}
                  className="rounded"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#2c2f31]">{task.title}</p>
                  <p className="truncate text-xs text-slate-500">{task.contact?.name || task.notes || 'Sem cliente associado'}</p>
                </div>
                <Badge variant={overdue ? 'destructive' : 'secondary'}>
                  {overdue ? 'Atraso' : formatDate(task.dueDate)}
                </Badge>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          Sem tarefas urgentes no período.
        </p>
      )}
    </SectionCard>
  );
}

function buildActivityItems(data: ServicesDashboardBase): ActivityItem[] {
  const actions = data.nextActions;
  const staleDeals = data.pipelineHealth?.staleDeals ?? [];
  if (!actions) return [];

  return [
    ...actions.overdueTasks.map((task) => ({
      id: `overdue-${task.id}`,
      label: 'Tarefa em atraso',
      detail: task.title,
      time: formatRelative(task.dueDate),
      tone: 'danger' as const,
    })),
    ...actions.followUpsToday.map((task) => ({
      id: `follow-${task.id}`,
      label: 'Follow-up marcado',
      detail: task.contact?.name || task.title,
      time: formatRelative(task.updatedAt),
      tone: 'normal' as const,
    })),
    ...actions.alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      label: alert.type === 'critical' ? 'Alerta crítico' : 'Alerta',
      detail: alert.title,
      time: formatRelative(alert.createdAt),
      tone: alert.type === 'critical' ? 'danger' as const : 'warning' as const,
    })),
    ...actions.birthdaysToday.map((contact) => ({
      id: `birthday-${contact.id}`,
      label: 'Aniversário',
      detail: contact.name,
      time: 'hoje',
      tone: 'success' as const,
    })),
    ...staleDeals.map((deal) => ({
      id: `deal-${deal.id}`,
      label: 'Negócio parado',
      detail: `${deal.name} em ${deal.stage}`,
      time: `${deal.daysInStage}d`,
      tone: 'warning' as const,
    })),
  ].slice(0, 5);
}

function ActivityCard({ data }: { data: ServicesDashboardBase }) {
  const items = buildActivityItems(data);

  return (
    <SectionCard title="Actividade recente">
      {items.length ? (
        <div className="flex flex-col divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className={cn(
                  'mt-1 block h-2 w-2 rounded-full',
                  item.tone === 'danger'
                    ? 'bg-red-500'
                    : item.tone === 'warning'
                    ? 'bg-amber-500'
                    : item.tone === 'success'
                    ? 'bg-emerald-500'
                    : 'bg-slate-400'
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#2c2f31]">{item.label}</p>
                <p className="truncate text-xs text-slate-500">{item.detail}</p>
              </div>
              <span className="text-xs text-slate-400">{item.time}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          Sem actividade recente para mostrar.
        </p>
      )}
    </SectionCard>
  );
}

function getFacturaStatusLabel(status: Factura['agtValidationStatus']) {
  if (status === 'P') return 'Pendente';
  if (status === 'V') return 'Emitida';
  if (status === 'I') return 'Inválida';
  return 'Anulada';
}

function PendingInvoicesCard({ facturas }: { facturas: Factura[] }) {
  return (
    <SectionCard
      title="Faturas pendentes"
      action={(
        <Button asChild size="sm" variant="ghost">
          <Link href="/faturacao">Ver todas</Link>
        </Button>
      )}
    >
      {facturas.length ? (
        <div className="flex flex-col divide-y divide-slate-100">
          {facturas.slice(0, 4).map((factura) => (
            <Link key={factura.id} href={`/faturacao/${factura.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#2c2f31]">
                  {factura.customerName || 'Cliente sem nome'}
                </p>
                <p className="text-xs text-slate-500">{factura.documentNo} · {formatDate(factura.documentDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#2c2f31]">{formatShortKz(factura.grossTotal)}</p>
                <Badge variant={factura.agtValidationStatus === 'I' ? 'destructive' : 'default'}>
                  {getFacturaStatusLabel(factura.agtValidationStatus)}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          Sem faturas pendentes no período.
        </p>
      )}
    </SectionCard>
  );
}

function DashboardCrm({ currentUser }: { currentUser: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const storageKey = dashboardWidgetStorageKey(currentUser.id);
  const [period, setPeriod] = useState<PeriodoDashboard>('month');
  const [customizing, setCustomizing] = useState(false);
  const [widgetVisibility, setWidgetVisibility] = useState(DEFAULT_WIDGET_VISIBILITY);
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  useEffect(() => {
    setWidgetVisibility(readWidgetVisibility(storageKey));
  }, [storageKey]);

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const {
    data: serviceDashboard,
    isLoading: serviceDashboardLoading,
    isError: serviceDashboardError,
    refetch: refetchServiceDashboard,
  } = useQuery({
    queryKey: ['services-dashboard-base', { period }],
    queryFn: () => getServicesDashboardBase({ period }),
    retry: false,
  });

  const { data: faturacaoDashboard } = useQuery({
    queryKey: ['faturacao-dashboard'],
    queryFn: getFaturacaoDashboard,
  });

  const { data: pendingFacturas } = useQuery({
    queryKey: ['dashboard-facturas-pendentes', period, dateRange],
    queryFn: () => getFacturas({
      agtStatus: 'P',
      documentStatus: 'N',
      limit: 4,
      startDate: dateRange.dateFrom,
      endDate: dateRange.dateTo,
    }),
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: number) => updateTask(taskId, { done: true } as Partial<Task>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-dashboard-base'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ variant: 'success', title: 'Tarefa concluída' });
    },
    onError: (error: Error) => {
      toast({ variant: 'error', title: 'Não foi possível concluir a tarefa', description: error.message || 'Tenta novamente.' });
    },
  });

  const pendingFacturaList = pendingFacturas?.facturas ?? [];
  const pendingInvoiceCount = faturacaoDashboard?.pendentesAGT ?? pendingFacturas?.total ?? pendingFacturaList.length;
  const pendingInvoiceAmount = pendingFacturaList.reduce((sum, factura) => sum + Number(factura.grossTotal || 0), 0);
  const accentColor = '#0A2540';

  const handleWidgetToggle = (id: DashboardWidgetId) => {
    setWidgetVisibility((current) => {
      const next = { ...current, [id]: !current[id] };
      if (storageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  };

  const kpiCards = serviceDashboard ? [
    {
      id: 'receita' as const,
      label: 'Receita',
      value: formatShortKz(serviceDashboard.kpis.closedRevenue),
      variation: 'Total fechado no período',
    },
    {
      id: 'pipeline' as const,
      label: 'Pipeline',
      value: formatShortKz(serviceDashboard.kpis.pipelineOpenValue),
      variation: serviceDashboard.kpiContext.pipelineOpenValue,
    },
    {
      id: 'clientes' as const,
      label: 'Clientes activos',
      value: formatNumber(serviceDashboard.kpis.openOpportunities),
      variation: 'Negócios activos no período',
    },
    {
      id: 'conversao' as const,
      label: 'Taxa conversão',
      value: serviceDashboard.kpis.winRate === null || serviceDashboard.kpis.winRate === undefined
        ? '—'
        : `${serviceDashboard.kpis.winRate}%`,
      variation: `${formatNumber(serviceDashboard.kpis.wonCount)} ganhos / ${formatNumber((serviceDashboard.kpis.wonCount ?? 0) + (serviceDashboard.kpis.lostCount ?? 0))} total`,
    },
    {
      id: 'facturas_atraso' as const,
      label: 'Faturas pendentes',
      value: `${formatNumber(pendingInvoiceCount)} · ${formatShortKz(pendingInvoiceAmount)}`,
      variation: 'Documentos ainda pendentes',
      danger: pendingInvoiceCount > 0,
    },
    {
      id: 'ticket_medio' as const,
      label: 'Ticket médio',
      value: formatShortKz(serviceDashboard.kpis.averageDealValue),
      variation: serviceDashboard.kpiContext.averageDealValue,
    },
  ].filter((card) => widgetVisibility[card.id]).slice(0, 6) : [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
      <TopBar
        userName={currentUser.name}
        period={period}
        customizing={customizing}
        onPeriodChange={setPeriod}
        onToggleCustomizing={() => setCustomizing((current) => !current)}
      />

      <BillingAccessBanner subscription={currentUser.subscription} />
      <StartupModelSelector currentUser={currentUser} />
      <OnboardingChecklist currentUser={currentUser} />

      {customizing ? (
        <WidgetPicker visible={widgetVisibility} onToggle={handleWidgetToggle} />
      ) : null}

      {serviceDashboardError ? (
        <ErrorState
          compact
          title="Não foi possível carregar o dashboard"
          message="O painel base não respondeu como esperado."
          onRetry={() => refetchServiceDashboard()}
        />
      ) : serviceDashboardLoading || !serviceDashboard ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:[grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            {kpiCards.map((card) => (
              <KpiCard
                key={card.id}
                label={card.label}
                value={card.value}
                variation={card.variation}
                danger={card.danger}
              />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {widgetVisibility.funil ? (
              <PipelineFunnelCard data={serviceDashboard} accentColor={accentColor} />
            ) : null}
            {widgetVisibility.tarefas ? (
              <TasksCard
                data={serviceDashboard}
                completingTaskId={completeTaskMutation.variables ?? null}
                onComplete={(taskId) => completeTaskMutation.mutate(taskId)}
                onCreate={() => setTaskModalOpen(true)}
              />
            ) : null}
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {widgetVisibility.actividade ? <ActivityCard data={serviceDashboard} /> : null}
            {widgetVisibility.facturas_pendentes ? (
              <PendingInvoicesCard facturas={pendingFacturaList} />
            ) : null}
          </section>
        </>
      )}

      <TaskFormModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} />
    </div>
  );
}

export default function Dashboard() {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 30_000,
  });

  if (isLoading || !currentUser) {
    return <DashboardSkeleton />;
  }

  if (isComercio(currentUser.workspaceMode)) {
    return <PainelComercialPage currentUser={currentUser} />;
  }

  return <DashboardCrm currentUser={currentUser} />;
}
