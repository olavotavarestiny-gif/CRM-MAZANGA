export interface TourStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
}

export interface TourGroup {
  id: number;
  route: string;
  steps: TourStep[];
}

export const TOUR_GROUPS: TourGroup[] = [
  {
    id: 0,
    route: '/',
    steps: [
      {
        element: '[data-tour="sidebar"]',
        popover: {
          title: 'Navegação principal',
          description: 'Acedes a todas as secções do KukuGest aqui. A barra lateral está sempre visível.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="sidebar-painel"]',
        popover: {
          title: 'Painel',
          description: 'Visão geral do negócio: métricas de vendas, tarefas do dia e actividade recente.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="sidebar-negociacoes"]',
        popover: {
          title: 'Negociações',
          description: 'O teu funil de vendas em Kanban. Arrasta os negócios entre fases para actualizar o estado.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="sidebar-contactos"]',
        popover: {
          title: 'Contactos',
          description: 'Base de dados de clientes e leads. Acede ao histórico completo de cada um.',
          side: 'right',
        },
      },
    ],
  },
  {
    id: 1,
    route: '/',
    steps: [
      {
        element: '[data-tour="dashboard-stats"]',
        popover: {
          title: 'Métricas principais',
          description: 'KPIs do negócio: novos contactos, qualificados, fechados e nas negociações. Personaliza estes widgets ao teu gosto.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="dashboard-tasks"]',
        popover: {
          title: 'Tarefas do dia',
          description: 'As tuas prioridades de hoje directamente no painel. Marca como concluídas sem sair desta página.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 2,
    route: '/pipeline',
    steps: [
      {
        element: '[data-tour="pipeline-add"]',
        popover: {
          title: 'Adicionar ao funil',
          description: 'Clica aqui para mover um contacto existente para o funil de vendas e começar a acompanhar o negócio.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="pipeline-board"]',
        popover: {
          title: 'Kanban de vendas',
          description: 'Cada coluna é uma fase da venda. Arrasta os cartões entre colunas para actualizar o estado em tempo real.',
          side: 'bottom',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 3,
    route: '/contacts',
    steps: [
      {
        element: '[data-tour="contacts-new"]',
        popover: {
          title: 'Novo contacto',
          description: 'Adiciona um cliente ou lead à base de dados. Podes também importar via CSV para migrar dados de outras ferramentas.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="contacts-filters"]',
        popover: {
          title: 'Filtros',
          description: 'Pesquisa por nome, telefone ou empresa. Usa Processos só quando a negociação precisar de acompanhamento mais próximo.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="contacts-table"]',
        popover: {
          title: 'Base de dados de clientes',
          description: 'Todos os teus contactos aqui. Clica no ícone de mensagem para ver o perfil completo e o histórico de interacções.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  {
    id: 4,
    route: '/tasks',
    steps: [
      {
        element: '[data-tour="tasks-stats"]',
        popover: {
          title: 'Estado das tarefas',
          description: 'Clica em Pendentes, Para hoje ou Atrasadas para filtrar a lista rapidamente e focar no que importa.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="tasks-new"]',
        popover: {
          title: 'Nova tarefa',
          description: 'Cria uma tarefa com título, prioridade (Alta/Média/Baixa), prazo e responsável. Mantém a equipa alinhada.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="tasks-list"]',
        popover: {
          title: 'Lista de tarefas',
          description: 'Todas as tarefas organizadas por prioridade. Marca como concluída ou edita os detalhes directamente aqui.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
];

export const TOUR_KEYS = {
  ACTIVE: 'kukugest_tour_active',
  GROUP: 'kukugest_tour_group',
} as const;

export const TOTAL_STEPS = TOUR_GROUPS.reduce((s, g) => s + g.steps.length, 0); // 14

export const GROUP_OFFSETS = TOUR_GROUPS.reduce<number[]>((acc, g, i) =>
  [...acc, i === 0 ? 0 : acc[i - 1] + TOUR_GROUPS[i - 1].steps.length], []);
