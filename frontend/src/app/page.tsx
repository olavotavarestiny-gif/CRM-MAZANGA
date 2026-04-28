'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  CreditCard,
  Filter,
  ListChecks,
  RotateCcw,
  Target,
  Users,
  Workflow,
} from 'lucide-react';
import { getCurrentUser, getServicesDashboardBase } from '@/lib/api';
import { isComercio } from '@/lib/business-modes';
import type { ServicesDashboardBase } from '@/lib/types';
import PainelComercialPage from '@/components/comercial/painel-comercial';
import OnboardingChecklist from '@/components/onboarding/onboarding-checklist';
import StartupModelSelector from '@/components/onboarding/startup-model-selector';
import { BillingAccessBanner } from '@/components/billing/access-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type VistaDashboard = 'comercial' | 'gestao' | 'operacional';
type PeriodoDashboard = 'month' | '7d' | '30d' | '90d';

interface DashboardFiltersState {
  period: PeriodoDashboard;
  responsibleUserId: string;
  stage: string;
  leadOrigin: string;
  segment: string;
}

interface MetricCardConfig {
  title: string;
  value: number | string | null | undefined;
  unit?: 'Kz' | '%' | 'dias' | 'numero' | 'Kz/dia';
  icon: typeof Banknote;
  tone?: 'normal' | 'danger' | 'warning' | 'success';
}

const ALL_VALUE = 'all';
const VIEW_STORAGE_PREFIX = 'dashboard_servicos_vista';
const FILTER_STORAGE_PREFIX = 'dashboard_servicos_filtros';
const DEFAULT_VIEW: VistaDashboard = 'comercial';
const DEFAULT_FILTERS: DashboardFiltersState = {
  period: 'month',
  responsibleUserId: ALL_VALUE,
  stage: ALL_VALUE,
  leadOrigin: ALL_VALUE,
  segment: ALL_VALUE,
};

const VIEW_OPTIONS: Array<{ value: VistaDashboard; label: string; description: string }> = [
  { value: 'comercial', label: 'Vista Comercial', description: 'Funil, acompanhamentos e risco comercial.' },
  { value: 'gestao', label: 'Vista Gestão', description: 'Receita, eficiência e performance.' },
  { value: 'operacional', label: 'Vista Operacional', description: 'Ações, alertas e rotina diária.' },
];

function getStorageKey(prefix: string, userId?: number | null) {
  return userId ? `${prefix}:${userId}` : null;
}

function readStoredView(storageKey: string | null): VistaDashboard {
  if (!storageKey || typeof window === 'undefined') return DEFAULT_VIEW;
  const stored = window.localStorage.getItem(storageKey);
  return stored === 'gestao' || stored === 'operacional' || stored === 'comercial'
    ? stored
    : DEFAULT_VIEW;
}

function readStoredFilters(storageKey: string | null): DashboardFiltersState {
  if (!storageKey || typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Partial<DashboardFiltersState>;
    return {
      period: parsed.period === '7d' || parsed.period === '30d' || parsed.period === '90d' || parsed.period === 'month'
        ? parsed.period
        : DEFAULT_FILTERS.period,
      responsibleUserId: parsed.responsibleUserId || ALL_VALUE,
      stage: parsed.stage || ALL_VALUE,
      leadOrigin: parsed.leadOrigin || ALL_VALUE,
      segment: parsed.segment || ALL_VALUE,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function formatKz(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(Number(value))} Kz`;
}

function formatMetricValue(metric: MetricCardConfig) {
  if (typeof metric.value === 'string') return metric.value;
  if (metric.value === null || metric.value === undefined) return '—';
  if (metric.unit === 'Kz') return formatKz(metric.value);
  if (metric.unit === 'Kz/dia') {
    return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(Number(metric.value))} Kz/dia`;
  }
  if (metric.unit === '%') return `${metric.value}%`;
  if (metric.unit === 'dias') return `${metric.value} dias`;
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Number(metric.value));
}

function getMetricToneClass(tone: MetricCardConfig['tone']) {
  switch (tone) {
    case 'danger':
      return 'bg-red-50 text-red-700';
    case 'warning':
      return 'bg-amber-50 text-amber-700';
    case 'success':
      return 'bg-emerald-50 text-emerald-700';
    default:
      return 'bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]';
  }
}

function MetricCard({ metric }: { metric: MetricCardConfig }) {
  const Icon = metric.icon;
  return (
    <Card className="border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#64748B]">{metric.title}</p>
          <p className="mt-2 text-xl font-bold text-[#0A2540]">{formatMetricValue(metric)}</p>
        </div>
        <div className={cn('rounded-lg p-2', getMetricToneClass(metric.tone))}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function getMetricsForView(view: VistaDashboard, data: ServicesDashboardBase): MetricCardConfig[] {
  const staleCount = data.pipelineHealth?.staleDeals.length || 0;
  const noFollowUpCount = data.pipelineHealth?.leadsWithoutFollowUp.length || 0;
  const overdueCount = data.nextActions?.overdueTasks.length || 0;
  const todayFollowUps = data.nextActions?.followUpsToday.length || 0;
  const birthdays = data.nextActions?.birthdaysToday.length || 0;
  const alerts = data.nextActions?.alerts.length || 0;

  if (view === 'gestao') {
    return [
      { title: 'Receita fechada', value: data.kpis.closedRevenue, unit: 'Kz', icon: Banknote, tone: 'success' },
      { title: 'Ticket médio', value: data.kpis.averageDealValue, unit: 'Kz', icon: CreditCard },
      { title: 'Taxa de ganho', value: data.kpis.winRate, unit: '%', icon: Target },
      { title: 'Velocidade do funil', value: data.kpis.pipelineVelocity, unit: 'Kz/dia', icon: BriefcaseBusiness },
      { title: 'Negócios ganhos', value: data.kpis.wonCount, unit: 'numero', icon: Users, tone: 'success' },
      { title: 'Negócios perdidos', value: data.kpis.lostCount, unit: 'numero', icon: AlertTriangle, tone: 'warning' },
    ];
  }

  if (view === 'operacional') {
    return [
      { title: 'Tarefas vencidas', value: overdueCount, unit: 'numero', icon: AlertTriangle, tone: overdueCount > 0 ? 'danger' : 'success' },
      { title: 'Acompanhamentos hoje', value: todayFollowUps, unit: 'numero', icon: ListChecks },
      { title: 'Aniversários', value: birthdays, unit: 'numero', icon: CalendarDays, tone: 'success' },
      { title: 'Alertas', value: alerts, unit: 'numero', icon: AlertTriangle, tone: alerts > 0 ? 'warning' : 'success' },
      { title: 'Potenciais clientes sem acompanhamento', value: noFollowUpCount, unit: 'numero', icon: Users, tone: noFollowUpCount > 0 ? 'warning' : 'success' },
      { title: 'Negócios parados', value: staleCount, unit: 'numero', icon: Clock3, tone: staleCount > 0 ? 'danger' : 'success' },
    ];
  }

  return [
    { title: 'Valor em aberto', value: data.kpis.pipelineOpenValue, unit: 'Kz', icon: Workflow },
    { title: 'Oportunidades abertas', value: data.kpis.openOpportunities, unit: 'numero', icon: BriefcaseBusiness },
    { title: 'Tempo de fecho', value: data.kpis.averageSalesCycleDays, unit: 'dias', icon: Clock3 },
    { title: 'Velocidade do funil', value: data.kpis.pipelineVelocity, unit: 'Kz/dia', icon: Target },
    { title: 'Negócios parados', value: staleCount, unit: 'numero', icon: AlertTriangle, tone: staleCount > 0 ? 'danger' : 'success' },
    { title: 'Acompanhamentos hoje', value: todayFollowUps, unit: 'numero', icon: ListChecks },
  ];
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="animate-pulse space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="h-8 w-32 rounded-full bg-slate-200" />
            <div className="h-4 w-56 rounded-full bg-slate-200" />
          </div>
          <div className="h-10 w-44 rounded-lg bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="h-80 rounded-lg bg-slate-100" />
          <div className="h-80 rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function ViewSelector({
  value,
  onChange,
}: {
  value: VistaDashboard;
  onChange: (value: VistaDashboard) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      {VIEW_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg border px-4 py-3 text-left transition-colors',
              selected
                ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]'
                : 'border-slate-200 bg-white text-[#0A2540] hover:border-slate-300'
            )}
          >
            <span className="block text-sm font-bold">{option.label}</span>
            <span className="mt-1 block text-xs text-[#64748B]">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function FiltersBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: DashboardFiltersState;
  options?: ServicesDashboardBase['filters'];
  onChange: (patch: Partial<DashboardFiltersState>) => void;
  onReset: () => void;
}) {
  const periods = options?.periods?.length ? options.periods : [
    { value: 'month', label: 'Este mês' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' },
  ];

  return (
    <Card className="border-slate-200 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0A2540]">
          <Filter className="h-4 w-4 text-[var(--workspace-primary)]" />
          Filtros
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Limpar
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#64748B]">Período</label>
          <Select value={filters.period} onValueChange={(value) => onChange({ period: value as PeriodoDashboard })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {periods.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#64748B]">Responsável</label>
          <Select value={filters.responsibleUserId} onValueChange={(value) => onChange({ responsibleUserId: value })}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todos</SelectItem>
              {(options?.responsibleUsers || []).map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#64748B]">Etapa do funil</label>
          <Select value={filters.stage} onValueChange={(value) => onChange({ stage: value })}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todas</SelectItem>
              {(options?.stages || []).map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {options?.leadOrigins?.length ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#64748B]">Origem do contacto</label>
            <Select value={filters.leadOrigin} onValueChange={(value) => onChange({ leadOrigin: value })}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todas</SelectItem>
                {options.leadOrigins.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {options?.segments?.length ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#64748B]">Segmento</label>
            <Select value={filters.segment} onValueChange={(value) => onChange({ segment: value })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                {options.segments.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PipelineHealthCard({ data, compact = false }: { data: ServicesDashboardBase; compact?: boolean }) {
  const health = data.pipelineHealth;
  return (
    <Card className="border-slate-200 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#0A2540]">Saúde do funil</h2>
          <p className="text-sm text-[#64748B]">Etapas, gargalos e oportunidades que precisam de atenção.</p>
        </div>
        {health?.slowestStage ? (
          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Gargalo: {health.slowestStage.stage}
          </span>
        ) : null}
      </div>

      {health ? (
        <div className="space-y-3">
          {health.byStage.slice(0, compact ? 4 : undefined).map((stage) => (
            <div key={stage.stage} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#0A2540]">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: stage.color }} />
                  <span className="truncate">{stage.stage}</span>
                </span>
                <span className="text-xs text-[#64748B]">{stage.count} aberto(s)</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#64748B]">
                <span>{stage.averageDaysInStage ?? 0} dias médios</span>
                <span>Conversão: {stage.conversionRate ?? 0}%</span>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {health.staleDeals.length} negócio(s) parado(s) há 14+ dias.
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              {health.leadsWithoutFollowUp.length} potenciais clientes sem acompanhamento futuro.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-100 p-4 text-sm text-[#64748B]">
          Sem permissão ou dados suficientes para mostrar o funil.
        </div>
      )}
    </Card>
  );
}

function NextActionsCard({ data }: { data: ServicesDashboardBase }) {
  const actions = data.nextActions;
  return (
    <Card className="border-slate-200 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#0A2540]">Próximas ações</h2>
        <p className="text-sm text-[#64748B]">Prioridades práticas para hoje.</p>
      </div>

      {actions ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xs font-medium text-red-700">Tarefas vencidas</p>
              <p className="mt-1 text-2xl font-bold text-red-700">{actions.overdueTasks.length}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">Acompanhamentos hoje</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{actions.followUpsToday.length}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">Aniversários</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{actions.birthdaysToday.length}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">Alertas</p>
              <p className="mt-1 text-2xl font-bold text-amber-700">{actions.alerts.length}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[...actions.overdueTasks, ...actions.followUpsToday].slice(0, 5).map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm text-[#0A2540]">
                {task.title}
                {task.contact?.name ? <span className="text-[#64748B]"> · {task.contact.name}</span> : null}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-100 p-4 text-sm text-[#64748B]">
          Sem permissão para consultar tarefas.
        </div>
      )}
    </Card>
  );
}

function AlertsCard({ data }: { data: ServicesDashboardBase }) {
  const alerts = data.nextActions?.alerts || [];
  const staleDeals = data.pipelineHealth?.staleDeals || [];
  const leadsWithoutFollowUp = data.pipelineHealth?.leadsWithoutFollowUp || [];
  const visibleItems = [
    ...alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      title: alert.title,
      detail: alert.contact?.name || alert.message || 'Alerta aberto',
      tone: 'warning' as const,
    })),
    ...staleDeals.slice(0, 3).map((deal) => ({
      id: `stale-${deal.id}`,
      title: `${deal.name} parado em ${deal.stage}`,
      detail: `${deal.daysInStage} dias na etapa`,
      tone: 'danger' as const,
    })),
    ...leadsWithoutFollowUp.slice(0, 3).map((lead) => ({
      id: `follow-${lead.id}`,
      title: `${lead.name} sem acompanhamento futuro`,
      detail: lead.stage,
      tone: 'warning' as const,
    })),
  ].slice(0, 8);

  return (
    <Card className="border-slate-200 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#0A2540]">Alertas e insights</h2>
          <p className="text-sm text-[#64748B]">Sinais simples para orientar a ação diária.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit gap-2">
          <Link href="/relatorios/servicos">
            <BarChart3 className="h-4 w-4" />
            Relatórios avançados
          </Link>
        </Button>
      </div>

      {visibleItems.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                item.tone === 'danger'
                  ? 'border-red-100 bg-red-50 text-red-700'
                  : 'border-amber-100 bg-amber-50 text-amber-700'
              )}
            >
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-xs opacity-80">{item.detail}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          Sem alertas críticos para os filtros atuais.
        </div>
      )}
    </Card>
  );
}

function DashboardCrm({ currentUser }: { currentUser: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const viewStorageKey = getStorageKey(VIEW_STORAGE_PREFIX, currentUser.id);
  const filterStorageKey = getStorageKey(FILTER_STORAGE_PREFIX, currentUser.id);
  const [view, setView] = useState<VistaDashboard>(DEFAULT_VIEW);
  const [filters, setFilters] = useState<DashboardFiltersState>(DEFAULT_FILTERS);

  useEffect(() => {
    setView(readStoredView(viewStorageKey));
  }, [viewStorageKey]);

  useEffect(() => {
    setFilters(readStoredFilters(filterStorageKey));
  }, [filterStorageKey]);

  const queryParams = useMemo(() => ({
    period: filters.period,
    responsibleUserId: filters.responsibleUserId === ALL_VALUE ? null : filters.responsibleUserId,
    stage: filters.stage === ALL_VALUE ? null : filters.stage,
    leadOrigin: filters.leadOrigin === ALL_VALUE ? null : filters.leadOrigin,
    segment: filters.segment === ALL_VALUE ? null : filters.segment,
  }), [filters]);

  const {
    data: serviceDashboard,
    isLoading: serviceDashboardLoading,
    isError: serviceDashboardError,
    refetch: refetchServiceDashboard,
  } = useQuery({
    queryKey: ['services-dashboard-base', queryParams],
    queryFn: () => getServicesDashboardBase(queryParams),
    retry: false,
  });

  const handleViewChange = (nextView: VistaDashboard) => {
    setView(nextView);
    if (viewStorageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(viewStorageKey, nextView);
    }
  };

  const handleFiltersChange = (patch: Partial<DashboardFiltersState>) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      if (filterStorageKey && typeof window !== 'undefined') {
        window.localStorage.setItem(filterStorageKey, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleFiltersReset = () => {
    setFilters(DEFAULT_FILTERS);
    if (filterStorageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(filterStorageKey, JSON.stringify(DEFAULT_FILTERS));
    }
  };

  const currentViewLabel = VIEW_OPTIONS.find((option) => option.value === view)?.label || 'Vista Comercial';
  const metrics = serviceDashboard ? getMetricsForView(view, serviceDashboard) : [];
  const compactPipeline = view === 'gestao' || view === 'operacional';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Painel</h1>
          <p className="mt-1 text-sm text-[#595c5e]">
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-[#64748B] shadow-sm">
          Vista ativa: <span className="font-semibold text-[#0A2540]">{currentViewLabel}</span>
        </div>
      </div>

      <BillingAccessBanner subscription={currentUser.subscription} />
      <StartupModelSelector currentUser={currentUser} />
      <OnboardingChecklist currentUser={currentUser} />

      <ViewSelector value={view} onChange={handleViewChange} />

      <FiltersBar
        filters={filters}
        options={serviceDashboard?.filters}
        onChange={handleFiltersChange}
        onReset={handleFiltersReset}
      />

      {serviceDashboardError ? (
        <ErrorState
          compact
          title="Não foi possível carregar os indicadores comerciais"
          message="O painel base não respondeu como esperado."
          onRetry={() => refetchServiceDashboard()}
        />
      ) : serviceDashboardLoading || !serviceDashboard ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-[var(--workspace-primary)]" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#64748B]">Indicadores principais</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} metric={metric} />
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PipelineHealthCard data={serviceDashboard} compact={compactPipeline} />
            <NextActionsCard data={serviceDashboard} />
          </section>

          <section>
            <AlertsCard data={serviceDashboard} />
          </section>
        </>
      )}
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
