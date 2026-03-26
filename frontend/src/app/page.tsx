'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getContacts, getTasks, getFinanceDashboard, getCurrentUser } from '@/lib/api';
import { useDashboardConfig } from '@/components/dashboard/use-dashboard-config';
import StatWidget from '@/components/dashboard/stat-widget';
import GoalWidget from '@/components/dashboard/goal-widget';
import TasksWidget from '@/components/dashboard/tasks-widget';
import PipelineWidget from '@/components/dashboard/pipeline-widget';
import WeeklyInsightCard from '@/components/dashboard/weekly-insight-card';
import DashboardCustomizer from '@/components/dashboard/dashboard-customizer';
import { WidgetSource, SOURCE_UNITS } from '@/components/dashboard/types';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { isSameDay, parseISO } from 'date-fns';

export default function Dashboard() {
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });
  const dashboardScope = currentUser?.id ?? 'demo-user';
  const { widgets, loaded } = useDashboardConfig(dashboardScope);

  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => getContacts() });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', 'pending'], queryFn: () => getTasks({ done: false }) });
  const { data: financeStats } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => getFinanceDashboard(),
    retry: false,
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const sourceValues: Record<WidgetSource, number> = {
    contacts_total:  contacts.length,
    contacts_month:  contacts.filter((c) => new Date(c.createdAt) >= startOfMonth).length,
    pipeline_count:  contacts.filter((c) => c.inPipeline).length,
    closed_total:    contacts.filter((c) => c.stage === 'Fechado').length,
    closed_month:    contacts.filter((c) => c.stage === 'Fechado' && new Date(c.updatedAt) >= startOfMonth).length,
    tasks_pending:   tasks.length,
    tasks_today:     tasks.filter((t) => {
      if (!t.dueDate) return false;
      try { const d = parseISO(t.dueDate); return isSameDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()), today); }
      catch { return false; }
    }).length,
    revenue_month:   financeStats?.revenue ?? 0,
    expenses_month:  financeStats?.expenses ?? 0,
    profit_month:    financeStats?.profit ?? 0,
    mrr:             financeStats?.mrr ?? 0,
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

  const visible = widgets.filter((w) => w.visible);
  const statGoalWidgets = visible.filter((w) => w.type === 'stat' || w.type === 'goal');
  const otherWidgets = visible.filter((w) => w.type === 'tasks' || w.type === 'pipeline');
  const pipelineCount = sourceValues.pipeline_count;
  const pendingTasks = sourceValues.tasks_pending;

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

      {/* Stat / Goal widgets grid */}
      {statGoalWidgets.length > 0 && (
        <div data-tour="dashboard-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {statGoalWidgets.map((w) => {
            const value = sourceValues[w.source!] ?? 0;
            const unit = w.unit || SOURCE_UNITS[w.source!] || '';
            if (w.type === 'goal' && w.target) {
              return (
                <GoalWidget
                  key={w.id}
                  title={w.title}
                  current={value}
                  target={w.target}
                  unit={unit}
                  color={w.color}
                />
              );
            }
            return (
              <StatWidget
                key={w.id}
                title={w.title}
                value={value}
                unit={unit}
                color={w.color}
              />
            );
          })}
        </div>
      )}

      <div className="mb-6 max-w-2xl">
        <WeeklyInsightCard pendingTasks={pendingTasks} pipelineCount={pipelineCount} />
      </div>

      {/* Tasks / Pipeline widgets */}
      {otherWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {otherWidgets.map((w) => {
            if (w.type === 'tasks') return <div key={w.id} data-tour="dashboard-tasks" className="col-span-full"><TasksWidget /></div>;
            if (w.type === 'pipeline') return <PipelineWidget key={w.id} />;
            return null;
          })}
        </div>
      )}

      <DashboardCustomizer
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        storageScope={dashboardScope}
      />
    </div>
  );
}
