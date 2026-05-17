'use client';

import {
  BarChart3, Kanban, Users, CheckSquare, CalendarDays,
  MessageSquare, Zap, FileText, DollarSign, Settings,
} from 'lucide-react';

export interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  highlight?: boolean;
  category?: 'main' | 'gestao' | 'config';
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'painel',
    icon: BarChart3,
    title: 'Painel',
    description: 'Visão geral do negócio: métricas de vendas, receitas do mês, tarefas pendentes e actividade recente numa só página.',
    highlight: true,
    category: 'main',
  },
  {
    id: 'negociacoes',
    icon: Kanban,
    title: 'Negociações',
    description: 'Kanban do funil de vendas. Arraste os negócios entre as fases (Proposta, Reunião, Fecho…) e acompanhe o valor total em pipeline.',
    highlight: true,
    category: 'main',
  },
  {
    id: 'contactos',
    icon: Users,
    title: 'Contactos',
    description: 'Base de dados de contactos e leads. Filtre por sector, etiqueta ou fase. Veja o histórico completo de interacções de cada contacto.',
    highlight: true,
    category: 'main',
  },
  {
    id: 'tarefas',
    icon: CheckSquare,
    title: 'Tarefas',
    description: 'Gestão de to-dos com prioridades (Alta, Média, Baixa), datas de entrega e atribuição de responsável. Filtre por estado e urgência.',
    category: 'main',
  },
  {
    id: 'calendario',
    icon: CalendarDays,
    title: 'Calendário',
    description: 'Agenda de eventos, reuniões e follow-ups. Integração com Google Calendar para sincronizar automaticamente os seus compromissos.',
    category: 'main',
  },
  {
    id: 'conversas',
    icon: MessageSquare,
    title: 'Conversas',
    description: 'Caixa de entrada unificada para WhatsApp Business e email. Responda a clientes sem sair da plataforma e mantenha todo o histórico centralizado.',
    highlight: true,
    category: 'main',
  },
  {
    id: 'automacoes',
    icon: Zap,
    title: 'Automações',
    description: 'Fluxos automáticos disparados por eventos: nova etiqueta, nova receita, mudança de sector, novo contacto ou submissão de formulário.',
    category: 'main',
  },
  {
    id: 'formularios',
    icon: FileText,
    title: 'Formulários',
    description: 'Crie formulários de captura de leads com link público partilhável. Os contactos criados ficam automaticamente na sua base de dados.',
    category: 'main',
  },
  {
    id: 'financas',
    icon: DollarSign,
    title: 'Finanças',
    description: 'Registo de receitas e despesas, análise de rentabilidade por cliente e emissão de facturas (disponível para proprietários de conta).',
    category: 'gestao',
  },
  {
    id: 'configuracoes',
    icon: Settings,
    title: 'Configurações',
    description: 'Gerir o perfil, alterar password, configurar integrações (WhatsApp, Email), gerir membros da equipa e ajustar preferências da conta.',
    category: 'config',
  },
];
