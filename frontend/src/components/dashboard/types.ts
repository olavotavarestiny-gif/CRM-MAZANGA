export type WidgetSource =
  | 'contacts_total'
  | 'contacts_month'
  | 'pipeline_count'
  | 'closed_total'
  | 'closed_month'
  | 'tasks_pending'
  | 'tasks_today'
  | 'overdue_tasks'
  | 'revenue_month'
  | 'expenses_month'
  | 'profit_month'
  | 'mrr'
  | 'receivables'
  | 'receivables_kz';

export type WidgetType = 'goal' | 'stat' | 'tasks' | 'pipeline';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  source?: WidgetSource;
  target?: number;      // for goal widgets
  unit?: string;        // e.g., "Kz", "leads", "contactos"
  color?: string;       // hex
  visible: boolean;
}

export const SOURCE_LABELS: Record<WidgetSource, string> = {
  contacts_total:  'Total de Contactos',
  contacts_month:  'Novos Contactos (mês)',
  pipeline_count:  'Em Processos de Venda',
  closed_total:    'Fechados (total)',
  closed_month:    'Fechados (mês)',
  tasks_pending:   'Tarefas Pendentes',
  tasks_today:     'Tarefas Hoje',
  overdue_tasks:   'Tarefas em Atraso',
  revenue_month:   'Receita (mês)',
  expenses_month:  'Despesas (mês)',
  profit_month:    'Lucro (mês)',
  mrr:             'Receita Mensal',
  receivables:     'Faturas por Cobrar',
  receivables_kz:  'Por Cobrar (Kz)',
};

export const SOURCE_UNITS: Record<WidgetSource, string> = {
  contacts_total:  'contactos',
  contacts_month:  'contactos',
  pipeline_count:  'contactos',
  closed_total:    'fechados',
  closed_month:    'fechados',
  tasks_pending:   'tarefas',
  tasks_today:     'tarefas',
  overdue_tasks:   'tarefas',
  revenue_month:   'Kz',
  expenses_month:  'Kz',
  profit_month:    'Kz',
  mrr:             'Kz',
  receivables:     'faturas',
  receivables_kz:  'Kz',
};

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'stat-pipeline', type: 'stat', title: 'Em Processos de Venda', source: 'pipeline_count', color: '#F59E0B', visible: true },
  { id: 'stat-overdue',  type: 'stat', title: 'Tarefas em Atraso', source: 'overdue_tasks', color: '#EF4444', visible: true },
  { id: 'stat-revenue',  type: 'stat', title: 'Receita do Mês', source: 'revenue_month', color: '#10B981', visible: true },
  { id: 'stat-recv',     type: 'stat', title: 'Faturas por Cobrar', source: 'receivables_kz', color: '#3B82F6', visible: true },
  { id: 'tasks-list',    type: 'tasks', title: 'Tarefas Pendentes', visible: true },
  { id: 'pipeline-sum',  type: 'pipeline', title: 'Resumo de Processos de Venda', visible: true },
];
