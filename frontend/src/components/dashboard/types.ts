export type WidgetSource =
  | 'contacts_total'
  | 'contacts_month'
  | 'pipeline_count'
  | 'closed_total'
  | 'closed_month'
  | 'tasks_pending'
  | 'tasks_today'
  | 'revenue_month'
  | 'expenses_month'
  | 'profit_month'
  | 'mrr';

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
  pipeline_count:  'Nas Negociações',
  closed_total:    'Fechados (total)',
  closed_month:    'Fechados (mês)',
  tasks_pending:   'Tarefas Pendentes',
  tasks_today:     'Tarefas Hoje',
  revenue_month:   'Receita (mês)',
  expenses_month:  'Despesas (mês)',
  profit_month:    'Lucro (mês)',
  mrr:             'MRR',
};

export const SOURCE_UNITS: Record<WidgetSource, string> = {
  contacts_total:  'contactos',
  contacts_month:  'contactos',
  pipeline_count:  'contactos',
  closed_total:    'fechados',
  closed_month:    'fechados',
  tasks_pending:   'tarefas',
  tasks_today:     'tarefas',
  revenue_month:   'Kz',
  expenses_month:  'Kz',
  profit_month:    'Kz',
  mrr:             'Kz',
};

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'stat-contacts', type: 'stat', title: 'Total Contactos', source: 'contacts_total', color: '#3B82F6', visible: true },
  { id: 'stat-month',    type: 'stat', title: 'Novos este Mês',  source: 'contacts_month', color: '#8B5CF6', visible: true },
  { id: 'stat-pipeline', type: 'stat', title: 'Nas Negociações', source: 'pipeline_count', color: '#F59E0B', visible: true },
  { id: 'stat-tasks',    type: 'stat', title: 'Tarefas Pendentes', source: 'tasks_pending', color: '#EF4444', visible: true },
  { id: 'tasks-list',    type: 'tasks', title: 'Tarefas Pendentes', visible: true },
  { id: 'pipeline-sum',  type: 'pipeline', title: 'Resumo do Pipeline', visible: true },
];
