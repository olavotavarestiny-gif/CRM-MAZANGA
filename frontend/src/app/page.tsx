'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  Filter,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  createLocalCalendarEvent,
  createTask,
  getCurrentUser,
  getServicesDashboardBase,
  updateServicesDashboardSettings,
  updateTask,
} from '@/lib/api';
import { isComercio } from '@/lib/business-modes';
import type { ServicesDashboardBase, Task } from '@/lib/types';
import PainelComercialPage from '@/components/comercial/painel-comercial';
import OnboardingChecklist from '@/components/onboarding/onboarding-checklist';
import StartupModelSelector from '@/components/onboarding/startup-model-selector';
import { BillingAccessBanner } from '@/components/billing/access-notice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-provider';
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
  context: string;
  tone?: 'normal' | 'danger' | 'warning' | 'success';
}

interface DashboardActionItem {
  id: string;
  type: 'task' | 'birthday' | 'alert';
  title: string;
  detail: string;
  priority: 'Alta' | 'Media' | 'Baixa';
  dueDate?: string | null;
  taskId?: number;
  contact?: { id: number; name: string; company?: string | null } | null;
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

function formatShortKz(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const number = Number(value || 0);
  if (Math.abs(number) >= 1_000_000) return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 1 }).format(number / 1_000_000)}M Kz`;
  if (Math.abs(number) >= 1_000) return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(number / 1_000)}k Kz`;
  return formatKz(number);
}

function formatRelativeUpdate(value?: string | null) {
  if (!value) return 'Atualizado agora';
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return 'Atualizado agora';
  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000));
  if (minutes < 1) return 'Atualizado agora';
  if (minutes === 1) return 'Atualizado há 1 minuto';
  if (minutes < 60) return `Atualizado há ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? 'Atualizado há 1 hora' : `Atualizado há ${hours} horas`;
}

function formatTaskTime(value?: string | null) {
  if (!value) return 'Sem hora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem hora';
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function getHealthLabel(status: ServicesDashboardBase['healthScore']['status']) {
  if (status === 'saudavel') return 'Saudável';
  if (status === 'atencao') return 'Atenção';
  return 'Risco';
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
          <p className="mt-1 text-xs text-[#64748B]">{metric.context}</p>
        </div>
        <div className={cn('rounded-lg p-2', getMetricToneClass(metric.tone))}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function getMetricsForView(_view: VistaDashboard, data: ServicesDashboardBase): MetricCardConfig[] {
  const todayFollowUps = data.nextActions?.followUpsToday.length || 0;

  return [
    {
      title: 'Pipeline em aberto',
      value: data.kpis.pipelineOpenValue,
      unit: 'Kz',
      icon: Workflow,
      context: data.kpiContext.pipelineOpenValue,
    },
    {
      title: 'Tempo médio de fecho',
      value: data.kpis.averageSalesCycleDays,
      unit: 'dias',
      icon: Clock3,
      context: data.kpiContext.averageSalesCycleDays,
    },
    {
      title: 'Ticket médio',
      value: data.kpis.averageDealValue,
      unit: 'Kz',
      icon: CreditCard,
      context: data.kpiContext.averageDealValue,
    },
    {
      title: 'Acompanhamentos hoje',
      value: todayFollowUps,
      unit: 'numero',
      icon: ListChecks,
      context: data.kpiContext.followUpsToday,
      tone: todayFollowUps > 0 ? 'normal' : 'success',
    },
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
        <div className="h-48 rounded-lg bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
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

function HeadlinePanel({
  data,
  goalDraft,
  canEditGoal,
  isSavingGoal,
  onGoalDraftChange,
  onGoalSave,
}: {
  data: ServicesDashboardBase;
  goalDraft: string;
  canEditGoal: boolean;
  isSavingGoal: boolean;
  onGoalDraftChange: (value: string) => void;
  onGoalSave: () => void;
}) {
  const status = data.healthScore.status;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#64748B]">
            <span>{formatRelativeUpdate(data.generatedAt)}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{data.headline.summary}</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--workspace-primary)]">
            Previsão do mês
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            <h2 className="text-4xl font-black tracking-tight text-[#0A2540] md:text-5xl">
              {formatShortKz(data.headline.monthlyForecastKz)}
            </h2>
            <span className={cn(
              'mb-1 rounded-full px-3 py-1 text-sm font-bold',
              status === 'risco'
                ? 'bg-red-50 text-red-700'
                : status === 'atencao'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
            )}>
              {getHealthLabel(status)}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[#64748B]">Meta atingida</p>
              <p className="mt-1 text-lg font-bold text-[#0A2540]">
                {data.goal.attainmentPercent !== null ? `${data.goal.attainmentPercent}%` : 'Sem meta'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Gap previsto</p>
              <p className="mt-1 text-lg font-bold text-[#0A2540]">{formatShortKz(data.goal.gapKz)}</p>
            </div>
            <div>
              <p className="text-xs text-[#64748B]">Risco ativo</p>
              <p className="mt-1 text-lg font-bold text-[#0A2540]">
                {data.headline.riskDealsCount} negócio(s)
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#0A2540]">Saúde KukuGest</p>
              <p className="mt-1 text-xs text-[#64748B]">{data.healthScore.reasons[0]}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[var(--workspace-primary)]" />
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-black text-[#0A2540]">{data.healthScore.score}</span>
            <span className="pb-2 text-sm font-semibold text-[#64748B]">/100</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-200">
            <div
              className={cn(
                'h-2 rounded-full',
                status === 'risco' ? 'bg-red-500' : status === 'atencao' ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${Math.max(4, data.healthScore.score)}%` }}
            />
          </div>

          {canEditGoal ? (
            <div className="mt-4 flex gap-2">
              <Input
                type="number"
                min="0"
                value={goalDraft}
                onChange={(event) => onGoalDraftChange(event.target.value)}
                placeholder="Meta mensal Kz"
                className="h-9 bg-white"
              />
              <Button size="sm" onClick={onGoalSave} disabled={isSavingGoal}>
                Guardar
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PipelineHealthCard({ data, expanded, onToggleExpanded }: { data: ServicesDashboardBase; expanded: boolean; onToggleExpanded: () => void }) {
  const health = data.pipelineHealth;
  const visibleStages = health
    ? [...health.byStage]
      .filter((stage) => stage.count > 0 || stage.stage === health.slowestStage?.stage)
      .sort((a, b) => (b.count - a.count) || ((b.averageDaysInStage || 0) - (a.averageDaysInStage || 0)))
      .slice(0, expanded ? undefined : 3)
    : [];
  return (
    <Card className="border-slate-200 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#0A2540]">Saúde do funil</h2>
          <p className="text-sm text-[#64748B]">Gargalo principal, risco e etapas que mais pesam agora.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {health?.slowestStage ? (
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Gargalo: {health.slowestStage.stage}
            </span>
          ) : null}
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#0A2540]">
            Velocidade: {formatShortKz(data.kpis.pipelineVelocity)}/dia
          </span>
        </div>
      </div>

      {health ? (
        <div className="space-y-3">
          {visibleStages.map((stage) => (
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
          {health.byStage.length > 3 ? (
            <Button variant="ghost" size="sm" onClick={onToggleExpanded} className="gap-2 px-0 text-[var(--workspace-primary)]">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? 'Ver menos' : 'Ver detalhe do funil'}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-100 p-4 text-sm text-[#64748B]">
          Sem permissão ou dados suficientes para mostrar o funil.
        </div>
      )}
    </Card>
  );
}

function buildActionItems(data: ServicesDashboardBase): DashboardActionItem[] {
  const actions = data.nextActions;
  if (!actions) return [];
  return [
    ...actions.overdueTasks.map((task) => ({
      id: `task-overdue-${task.id}`,
      type: 'task' as const,
      title: task.title,
      detail: task.contact?.name || 'Tarefa vencida',
      priority: task.priority,
      dueDate: task.dueDate,
      taskId: task.id,
      contact: task.contact,
    })),
    ...actions.followUpsToday.map((task) => ({
      id: `task-today-${task.id}`,
      type: 'task' as const,
      title: task.title,
      detail: task.contact?.name || 'Acompanhamento de hoje',
      priority: task.priority,
      dueDate: task.dueDate,
      taskId: task.id,
      contact: task.contact,
    })),
    ...actions.birthdaysToday.map((contact) => ({
      id: `birthday-${contact.id}`,
      type: 'birthday' as const,
      title: 'Dar parabéns ao cliente',
      detail: contact.name,
      priority: 'Baixa' as const,
      dueDate: contact.birthDate,
      contact,
    })),
    ...actions.alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      type: 'alert' as const,
      title: alert.title,
      detail: alert.contact?.name || alert.message || 'Alerta aberto',
      priority: alert.type === 'critical' ? 'Alta' as const : 'Media' as const,
      dueDate: alert.createdAt,
      contact: alert.contact,
    })),
  ].slice(0, 8);
}

function NextActionsCard({
  data,
  completingTaskId,
  onCompleteTask,
  onCreateFollowUp,
}: {
  data: ServicesDashboardBase;
  completingTaskId: number | null;
  onCompleteTask: (taskId: number) => void;
  onCreateFollowUp: (item: DashboardActionItem) => void;
}) {
  const actions = data.nextActions;
  const items = buildActionItems(data);
  return (
    <Card className="border-slate-200 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[#0A2540]">Próximas ações</h2>
        <p className="text-sm text-[#64748B]">Prioridades práticas para hoje.</p>
      </div>

      {actions ? (
        items.length ? (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-3">
                <button
                  type="button"
                  disabled={!item.taskId || completingTaskId === item.taskId}
                  onClick={() => item.taskId && onCompleteTask(item.taskId)}
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border',
                    item.taskId ? 'border-slate-300 hover:border-[var(--workspace-primary)]' : 'border-slate-200 bg-slate-50'
                  )}
                  aria-label="Concluir tarefa"
                >
                  {item.taskId && completingTaskId === item.taskId ? (
                    <span className="h-2 w-2 rounded-full bg-[var(--workspace-primary)]" />
                  ) : null}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#0A2540]">{item.title}</p>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      item.priority === 'Alta' ? 'bg-red-50 text-red-700' : item.priority === 'Media' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    )}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#64748B]">
                    {formatTaskTime(item.dueDate)} · {item.detail}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onCreateFollowUp(item)}>
                  Agendar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            Sem ações urgentes para hoje.
          </div>
        )
      ) : (
        <div className="rounded-lg border border-slate-100 p-4 text-sm text-[#64748B]">
          Sem permissão para consultar tarefas.
        </div>
      )}
    </Card>
  );
}

function AlertsCard({
  data,
  onCreateTask,
  onCreateFollowUp,
}: {
  data: ServicesDashboardBase;
  onCreateTask: (item: DashboardActionItem) => void;
  onCreateFollowUp: (item: DashboardActionItem) => void;
}) {
  const alerts = data.nextActions?.alerts || [];
  const staleDeals = data.pipelineHealth?.staleDeals || [];
  const leadsWithoutFollowUp = data.pipelineHealth?.leadsWithoutFollowUp || [];
  const visibleItems: Array<DashboardActionItem & { tone: 'danger' | 'warning' | 'success'; group: string }> = [
    ...alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      type: 'alert' as const,
      title: alert.title,
      detail: alert.contact?.name || alert.message || 'Alerta aberto',
      priority: alert.type === 'critical' ? 'Alta' as const : 'Media' as const,
      dueDate: alert.createdAt,
      contact: alert.contact,
      tone: alert.type === 'opportunity' ? 'success' as const : alert.type === 'critical' ? 'danger' as const : 'warning' as const,
      group: alert.type === 'opportunity' ? 'Oportunidade' : alert.type === 'critical' ? 'Crítico' : 'Atenção',
    })),
    ...staleDeals.slice(0, 3).map((deal) => ({
      id: `stale-${deal.id}`,
      type: 'alert' as const,
      title: `${deal.name} parado em ${deal.stage}`,
      detail: `${deal.daysInStage} dias na etapa`,
      priority: 'Alta' as const,
      contact: { id: deal.id, name: deal.name, company: deal.company },
      tone: 'danger' as const,
      group: 'Crítico',
    })),
    ...leadsWithoutFollowUp.slice(0, 3).map((lead) => ({
      id: `follow-${lead.id}`,
      type: 'alert' as const,
      title: `${lead.name} sem acompanhamento futuro`,
      detail: lead.stage,
      priority: 'Media' as const,
      contact: { id: lead.id, name: lead.name, company: lead.company },
      tone: 'warning' as const,
      group: 'Atenção',
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
                'rounded-lg border px-3 py-3 text-sm',
                item.tone === 'danger'
                  ? 'border-red-100 bg-red-50 text-red-700'
                  : item.tone === 'success'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : 'border-amber-100 bg-amber-50 text-amber-700'
              )}
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-80">{item.group}</p>
              <p className="mt-1 font-semibold">{item.title}</p>
              <p className="mt-1 text-xs opacity-80">{item.detail}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onCreateTask(item)}>
                  Criar tarefa
                </Button>
                <Button variant="outline" size="sm" onClick={() => onCreateFollowUp(item)}>
                  Agendar follow-up
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
          Sem alertas críticos. Mantém os acompanhamentos de hoje em dia.
        </div>
      )}
    </Card>
  );
}

function DashboardCrm({ currentUser }: { currentUser: Awaited<ReturnType<typeof getCurrentUser>> }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const viewStorageKey = getStorageKey(VIEW_STORAGE_PREFIX, currentUser.id);
  const filterStorageKey = getStorageKey(FILTER_STORAGE_PREFIX, currentUser.id);
  const [view, setView] = useState<VistaDashboard>(DEFAULT_VIEW);
  const [filters, setFilters] = useState<DashboardFiltersState>(DEFAULT_FILTERS);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

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

  useEffect(() => {
    if (serviceDashboard?.goal.monthlyRevenueGoalKz !== undefined) {
      setGoalDraft(serviceDashboard.goal.monthlyRevenueGoalKz ? String(serviceDashboard.goal.monthlyRevenueGoalKz) : '');
    }
  }, [serviceDashboard?.goal.monthlyRevenueGoalKz]);

  const goalMutation = useMutation({
    mutationFn: () => updateServicesDashboardSettings({
      monthlyRevenueGoalKz: goalDraft === '' ? null : Number(goalDraft),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-dashboard-base'] });
      toast({ variant: 'success', title: 'Meta atualizada', description: 'A previsão do painel foi recalculada.' });
    },
    onError: (error: Error) => {
      toast({ variant: 'error', title: 'Não foi possível guardar a meta', description: error.message || 'Tenta novamente.' });
    },
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

  const createTaskMutation = useMutation({
    mutationFn: (item: DashboardActionItem) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      dueDate.setHours(9, 0, 0, 0);
      return createTask({
        title: item.type === 'birthday' ? item.title : `Follow-up: ${item.title}`,
        notes: item.detail,
        contactId: item.contact?.id ?? null,
        dueDate: dueDate.toISOString(),
        priority: item.priority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-dashboard-base'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ variant: 'success', title: 'Tarefa criada' });
    },
    onError: (error: Error) => {
      toast({ variant: 'error', title: 'Não foi possível criar tarefa', description: error.message || 'Tenta novamente.' });
    },
  });

  const createFollowUpMutation = useMutation({
    mutationFn: (item: DashboardActionItem) => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);
      return createLocalCalendarEvent({
        title: item.type === 'birthday' ? item.title : `Follow-up: ${item.title}`,
        notes: item.detail,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        contactId: item.contact?.id ?? null,
        assignedToUserId: currentUser.id,
        syncWithGoogle: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localCalendarEvents'] });
      toast({ variant: 'success', title: 'Follow-up agendado' });
    },
    onError: (error: Error) => {
      toast({ variant: 'error', title: 'Não foi possível agendar follow-up', description: error.message || 'Tenta novamente.' });
    },
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
  const canEditGoal = !!(currentUser.isSuperAdmin || currentUser.role === 'admin' || !currentUser.accountOwnerId);

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
          <HeadlinePanel
            data={serviceDashboard}
            goalDraft={goalDraft}
            canEditGoal={canEditGoal}
            isSavingGoal={goalMutation.isPending}
            onGoalDraftChange={setGoalDraft}
            onGoalSave={() => goalMutation.mutate()}
          />

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-[var(--workspace-primary)]" />
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#64748B]">Indicadores principais</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} metric={metric} />
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PipelineHealthCard
              data={serviceDashboard}
              expanded={pipelineExpanded}
              onToggleExpanded={() => setPipelineExpanded((current) => !current)}
            />
            <NextActionsCard
              data={serviceDashboard}
              completingTaskId={completeTaskMutation.variables ?? null}
              onCompleteTask={(taskId) => completeTaskMutation.mutate(taskId)}
              onCreateFollowUp={(item) => createFollowUpMutation.mutate(item)}
            />
          </section>

          <section>
            <AlertsCard
              data={serviceDashboard}
              onCreateTask={(item) => createTaskMutation.mutate(item)}
              onCreateFollowUp={(item) => createFollowUpMutation.mutate(item)}
            />
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
