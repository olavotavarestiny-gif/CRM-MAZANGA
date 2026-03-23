import { BarChart3, Kanban, Users, CheckSquare, CalendarDays, FileText, Zap, DollarSign, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface OnboardingTask {
  id: string;
  label: string;
  description: string;
  route: string;
  icon: LucideIcon;
}

export const ONBOARDING_TASKS: OnboardingTask[] = [
  { id: 'painel',        label: 'Explorar o Painel',    description: 'Métricas e KPIs do negócio',                 route: '/',              icon: BarChart3 },
  { id: 'pipeline',      label: 'Abrir o Pipeline',     description: 'Funil de vendas em Kanban',                  route: '/pipeline',      icon: Kanban },
  { id: 'contactos',     label: 'Ver Contactos',        description: 'Base de dados de clientes e leads',          route: '/contacts',      icon: Users },
  { id: 'tarefas',       label: 'Ver Tarefas',          description: 'Organiza o trabalho do dia',                 route: '/tasks',         icon: CheckSquare },
  { id: 'calendario',    label: 'Ver Calendário',       description: 'Agenda e eventos da equipa',                 route: '/calendario',    icon: CalendarDays },
  { id: 'formularios',   label: 'Ver Formulários',      description: 'Capta leads com formulários personalizados', route: '/forms',         icon: FileText },
  { id: 'automacoes',    label: 'Ver Automações',       description: 'Regras automáticas para poupar tempo',       route: '/automations',   icon: Zap },
  { id: 'financas',      label: 'Explorar Finanças',    description: 'Receitas, despesas e facturas',              route: '/finances',      icon: DollarSign },
  { id: 'configuracoes', label: 'Configurar a Conta',   description: 'Perfil, empresa e equipa',                   route: '/configuracoes', icon: Settings },
];

export const ONBOARDING_KEY = 'kukugest_onboarding';       // JSON array of completed IDs
export const ONBOARDING_DISMISSED = 'kukugest_onboarding_done'; // '1' when dismissed
export const ONBOARDING_OPEN = 'kukugest_onboarding_open'; // '1' to auto-open panel on next render
