'use client';

import { useEffect, useRef, useState } from 'react';
import { isPast, isSameDay, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  Clock3,
  CreditCard,
  Settings2,
  Workflow,
} from 'lucide-react';
import { getContacts, getCurrentUser, getDailySuggestion, getFinanceDashboard, getTasks } from '@/lib/api';
import { isComercio } from '@/lib/business-modes';
import type { Contact, DashboardStats, Task } from '@/lib/types';
import PainelComercialPage from '@/components/comercial/painel-comercial';
import DashboardCustomizer from '@/components/dashboard/dashboard-customizer';
import GoalWidget from '@/components/dashboard/goal-widget';
import PipelineWidget from '@/components/dashboard/pipeline-widget';
import StatWidget from '@/components/dashboard/stat-widget';
import TasksWidget from '@/components/dashboard/tasks-widget';
import { SOURCE_UNITS, type DashboardWidget, type WidgetSource } from '@/components/dashboard/types';
import { useDashboardConfig } from '@/components/dashboard/use-dashboard-config';
import SuggestionCard from '@/components/dashboard/suggestion-card';
import WidgetWrapper from '@/components/dashboard/widget-wrapper';
import OnboardingChecklist from '@/components/onboarding/onboarding-checklist';
import { useToast } from '@/components/ui/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';

const CONTACT_SOURCES = new Set<WidgetSource>([
  'contacts_total',
  'contacts_month',
  'pipeline_count',
  'closed_total',
  'closed_month',
]);

const TASK_SOURCES = new Set<WidgetSource>([
  'tasks_pending',
  'tasks_today',
  'overdue_tasks',
]);

const FINANCE_SOURCES = new Set<WidgetSource>([
  'revenue_month',
  'expenses_month',
  'profit_month',
  'mrr',
  'receivables',
  'receivables_kz',
]);

function isOverdueTask(task: Task, today: Date) {
  if (task.done || !task.dueDate) return false;

  try {
    const dueDate = parseISO(task.dueDate);
    if (isSameDay(dueDate, today)) return false;
    return isPast(dueDate);
  } catch {
    return false;
  }
}

function buildContactSourceValues(contacts: Contact[], startOfMonth: Date) {
  return {
    contacts_total: contacts.length,
    contacts_month: contacts.filter((contact) => new Date(contact.createdAt) >= startOfMonth).length,
    pipeline_count: contacts.filter((contact) => contact.inPipeline).length,
    closed_total: contacts.filter((contact) => contact.stage === 'Fechado').length,
    closed_month: contacts.filter((contact) => contact.stage === 'Fechado' && new Date(contact.updatedAt) >= startOfMonth).length,
  };
}

function buildTaskSourceValues(tasks: Task[], today: Date) {
  return {
    tasks_pending: tasks.length,
    tasks_today: tasks.filter((task) => {
      if (!task.dueDate) return false;

      try {
        return isSameDay(parseISO(task.dueDate), today);
      } catch {
        return false;
      }
    }).length,
    overdue_tasks: tasks.filter((task) => isOverdueTask(task, today)).length,
  };
}

function getFinanceValue(source: WidgetSource, financeStats?: DashboardStats) {
  if (!financeStats) return 0;

  switch (source) {
    case 'revenue_month':
      return financeStats.revenue;
    case 'expenses_month':
      return financeStats.expenses;
    case 'profit_month':
      return financeStats.profit;
    case 'mrr':
      return financeStats.receitaMensal ?? financeStats.mrr;
    case 'receivables':
      return financeStats.receivablesCount;
    case 'receivables_kz':
      return financeStats.receivablesTotal;
    default:
      return 0;
  }
}

function getWidgetTitle(widget: DashboardWidget) {
  if (widget.source === 'mrr' && (widget.title === 'MRR' || widget.title === 'Receita Mensal')) {
    return 'Receita Mensal';
  }

  return widget.title;
}

function getMetricIcon(source: WidgetSource) {
  switch (source) {
    case 'pipeline_count':
      return Workflow;
    case 'overdue_tasks':
      return AlertTriangle;
    case 'revenue_month':
    case 'profit_month':
      return Banknote;
    case 'receivables':
    case 'receivables_kz':
      return CreditCard;
    default:
      return BriefcaseBusiness;
  }
}

function FinanceMetricWidget({ widget }: { widget: DashboardWidget }) {
  const source = widget.source;
  const {
    data: financeStats,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => getFinanceDashboard(),
    retry: false,
  });

  if (!source) return null;

  const title = getWidgetTitle(widget);
  const value = getFinanceValue(source, financeStats);
  const unit = widget.unit || SOURCE_UNITS[source] || '';
  const delta = source === 'revenue_month' && financeStats && financeStats.prevRevenue > 0
    ? ((financeStats.revenue - financeStats.prevRevenue) / financeStats.prevRevenue) * 100
    : undefined;

  return (
    <WidgetWrapper
      title={title}
      isLoading={isLoading}
      error={isError}
      onRetry={() => refetch()}
    >
      {widget.type === 'goal' && widget.target ? (
        <GoalWidget
          title={title}
          current={value}
          target={widget.target}
          unit={unit}
          color={widget.color}
        />
      ) : (
        <StatWidget
          title={title}
          value={value}
          unit={unit}
          color={widget.color}
          delta={delta}
          icon={getMetricIcon(source)}
        />
      )}
    </WidgetWrapper>
  );
}

function DashboardCrm({ currentUser }: { currentUser: Awaited<ReturnType<typeof getCurrentUser>> | undefined }) {
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const dashboardScope = currentUser?.id ?? 'demo-user';
  const { widgets, loaded } = useDashboardConfig(dashboardScope);
  const { toast } = useToast();
  const toastShownRef = useRef(false);

  const { data: dailySuggestion } = useQuery({
    queryKey: ['daily-suggestion'],
    queryFn: getDailySuggestion,
    staleTime: 1000 * 60 * 60 * 8,
    retry: false,
  });

  useEffect(() => {
    if (toastShownRef.current) return;
    const s = dailySuggestion?.suggestion;
    if (s && s.type === 'action' && s.priority >= 9) {
      toastShownRef.current = true;
      toast({ title: s.title, description: s.message, variant: 'info' });
    }
  }, [dailySuggestion, toast]);

  const {
    data: contacts = [],
    isLoading: contactsLoading,
    isError: contactsError,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
  });
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['tasks', 'pending'],
    queryFn: () => getTasks({ done: false }),
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const sourceValues: Record<WidgetSource, number> = {
    ...buildContactSourceValues(contacts, startOfMonth),
    ...buildTaskSourceValues(tasks, today),
    revenue_month: 0,
    expenses_month: 0,
    profit_month: 0,
    mrr: 0,
    receivables: 0,
    receivables_kz: 0,
  };

  if (!loaded) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="h-8 w-32 rounded-full bg-slate-200" />
              <div className="h-4 w-56 rounded-full bg-slate-200" />
            </div>
            <div className="h-10 w-32 rounded-xl bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 rounded-2xl bg-slate-200" />
            ))}
          </div>
          <div className="h-44 max-w-2xl rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  const visible = widgets.filter((widget) => widget.visible);
  const statGoalWidgets = visible.filter((widget) => widget.type === 'stat' || widget.type === 'goal');
  const otherWidgets = visible.filter((widget) => widget.type === 'tasks' || widget.type === 'pipeline');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[#2c2f31] tracking-tight">Painel</h1>
          <p className="text-sm text-[#595c5e] mt-0.5">
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCustomizerOpen(true)}>
          <Settings2 className="w-4 h-4 mr-2" />
          Personalizar
        </Button>
      </div>

      <OnboardingChecklist currentUser={currentUser} />

      {(contactsError || tasksError) && (
        <div className="mb-6">
          <ErrorState
            compact
            title="Não foi possível carregar o painel"
            message="Alguns dados do painel não responderam como esperado."
            onRetry={() => {
              refetchContacts();
              refetchTasks();
            }}
          />
        </div>
      )}

      {statGoalWidgets.length > 0 && (
        <div data-tour="dashboard-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {statGoalWidgets.map((widget) => {
            const source = widget.source;
            if (!source) return null;
            const title = getWidgetTitle(widget);

            if (FINANCE_SOURCES.has(source)) {
              return <FinanceMetricWidget key={widget.id} widget={{ ...widget, title }} />;
            }

            const isContactsSource = CONTACT_SOURCES.has(source);
            const isTasksSource = TASK_SOURCES.has(source);
            const isLoading = isContactsSource ? contactsLoading : isTasksSource ? tasksLoading : false;
            const hasError = isContactsSource ? contactsError : isTasksSource ? tasksError : false;
            const unit = widget.unit || SOURCE_UNITS[source] || '';
            const value = sourceValues[source] ?? 0;
            const href = source === 'overdue_tasks' ? '/tasks?filter=atrasadas' : undefined;

            return (
              <WidgetWrapper
                key={widget.id}
                title={title}
                isLoading={isLoading}
                error={hasError}
                onRetry={() => {
                  if (isContactsSource) refetchContacts();
                  if (isTasksSource) refetchTasks();
                }}
              >
                {widget.type === 'goal' && widget.target ? (
                  <GoalWidget
                    title={title}
                    current={value}
                    target={widget.target}
                    unit={unit}
                    color={widget.color}
                  />
                ) : (
                  <StatWidget
                    title={title}
                    value={value}
                    unit={unit}
                    color={widget.color}
                    href={href}
                    icon={getMetricIcon(source)}
                  />
                )}
              </WidgetWrapper>
            );
          })}
        </div>
      )}

      {dailySuggestion?.show && (
        <div className="mb-6 max-w-2xl">
          <SuggestionCard suggestion={dailySuggestion.suggestion} />
        </div>
      )}

      {otherWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {otherWidgets.map((widget) => {
            if (widget.type === 'tasks') {
              return <div key={widget.id} data-tour="dashboard-tasks" className="col-span-full"><TasksWidget /></div>;
            }
            if (widget.type === 'pipeline') {
              return <PipelineWidget key={widget.id} />;
            }
            return null;
          })}
        </div>
      )}

      {statGoalWidgets.length === 0 && otherWidgets.length === 0 && (
        <Card>
          <div className="p-8 text-center">
            <h2 className="text-lg font-semibold text-[#2c2f31]">Nenhum widget ativo</h2>
            <p className="mt-2 text-sm text-[#6b7e9a]">
              Usa “Personalizar” para adicionar widgets ao teu painel.
            </p>
          </div>
        </Card>
      )}

      <DashboardCustomizer
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        storageScope={dashboardScope}
      />
    </div>
  );
}

export default function Dashboard() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });

  if (isComercio(currentUser?.workspaceMode)) {
    return <PainelComercialPage currentUser={currentUser} />;
  }

  return <DashboardCrm currentUser={currentUser} />;
}
