import type { WorkspaceMode } from './business-modes';
import type { ModuleKey } from './permissions';

// Chave do módulo para tracking de onboarding (1ª visita).
// Inclui 'painel' (sempre desbloqueado) além dos ModuleKey do sistema de permissões
// e as rotas específicas de comércio (caixa, vendas-rapidas, produtos).
export type IntroModuleKey =
  | 'painel'
  | ModuleKey
  | 'caixa'
  | 'vendas-rapidas'
  | 'produtos';

export interface ModuleIntroContent {
  title: string;
  intro: string;
  bullets: string[];
}

// Variante por workspace: 'both' aplica a serviços, comércio e Food;
// caso contrário pode haver conteúdo distinto para cada modo.
type IntroEntry =
  | { both: ModuleIntroContent }
  | { servicos?: ModuleIntroContent; comercio?: ModuleIntroContent; food?: ModuleIntroContent };

// Mapeia a pathname para a chave de módulo. Devolve null se a rota não tem intro.
export function routeToModuleKey(pathname: string): IntroModuleKey | null {
  if (pathname === '/' || pathname === '/dashboard') return 'painel';
  if (pathname.startsWith('/contacts')) return 'contacts';
  if (pathname.startsWith('/pipeline')) return 'pipeline';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/calendario') || pathname.startsWith('/calendar')) return 'calendario';
  if (pathname.startsWith('/automations')) return 'automations';
  if (pathname.startsWith('/forms')) return 'forms';
  if (pathname.startsWith('/finances')) return 'finances';
  if (pathname.startsWith('/caixa')) return 'caixa';
  if (pathname.startsWith('/vendas-rapidas')) return 'vendas-rapidas';
  if (pathname.startsWith('/food')) return 'food';
  if (pathname.startsWith('/produtos')) return 'produtos';
  // /vendas e /faturacao → módulo de vendas/faturação
  if (pathname.startsWith('/vendas') || pathname.startsWith('/faturacao')) return 'vendas';
  return null;
}

const CONTENT: Record<IntroModuleKey, IntroEntry> = {
  painel: {
    servicos: {
      title: 'Painel',
      intro: 'A tua visão geral do negócio num só sítio.',
      bullets: [
        'Métricas-chave: novos contactos, qualificados e negócios fechados.',
        'As tarefas de hoje aparecem aqui — podes marcá-las como concluídas sem sair.',
        'Personaliza os widgets para veres primeiro o que importa.',
      ],
    },
    comercio: {
      title: 'Painel',
      intro: 'A visão geral da tua operação comercial.',
      bullets: [
        'Resumo de vendas do dia, da semana e do mês.',
        'Estado do caixa e dos produtos com stock baixo.',
        'As tarefas de hoje directamente no painel.',
      ],
    },
  },
  contacts: {
    servicos: {
      title: 'Contactos',
      intro: 'A tua base de dados de leads e clientes.',
      bullets: [
        'Adiciona contactos manualmente ou importa via CSV.',
        'Cada contacto guarda o histórico completo de interacções.',
        'Filtra por nome, telefone ou empresa para encontrar rápido.',
      ],
    },
    comercio: {
      title: 'Clientes',
      intro: 'A tua base de dados de clientes.',
      bullets: [
        'Regista clientes para associar a vendas e faturas.',
        'Consulta o histórico de compras de cada cliente.',
        'Importa clientes existentes via CSV.',
      ],
    },
  },
  pipeline: {
    both: {
      title: 'Processos de Venda',
      intro: 'Acompanha cada negócio do início ao fecho, em Kanban.',
      bullets: [
        'Cada coluna é uma fase da venda — arrasta os cartões para actualizar.',
        'Move um contacto para os processos quando há negociação a acompanhar.',
        'Vê o valor total em cada fase para prever a receita.',
      ],
    },
  },
  tasks: {
    both: {
      title: 'Tarefas',
      intro: 'Organiza follow-ups, prioridades e prazos da equipa.',
      bullets: [
        'Cria tarefas com prioridade (Alta/Média/Baixa), prazo e responsável.',
        'Filtra por Pendentes, Para hoje ou Atrasadas.',
        'Marca como concluída directamente na lista.',
      ],
    },
  },
  chat: {
    both: {
      title: 'Chat interno',
      intro: 'Comunicação interna entre os membros da tua equipa.',
      bullets: [
        'Conversa com colegas sem sair do CRM.',
        'Mantém o contexto do trabalho no mesmo sítio.',
        'Ideal para alinhar a equipa sobre clientes e tarefas.',
      ],
    },
  },
  calendario: {
    both: {
      title: 'Calendário',
      intro: 'A agenda da tua equipa, integrada com o CRM.',
      bullets: [
        'Cria eventos e reuniões associados a contactos.',
        'Vê os compromissos da equipa numa só vista.',
        'Sincroniza com o Google Calendar.',
      ],
    },
  },
  automations: {
    both: {
      title: 'Automações',
      intro: 'Põe tarefas repetitivas a funcionar sozinhas.',
      bullets: [
        'Define gatilhos: nova etiqueta, novo contacto, submissão de formulário, etc.',
        'Executa acções automáticas quando a condição acontece.',
        'Poupa tempo e garante que nada é esquecido.',
      ],
    },
  },
  forms: {
    both: {
      title: 'Formulários',
      intro: 'Capta leads com formulários públicos partilháveis.',
      bullets: [
        'Cria um formulário e partilha o link gerado automaticamente.',
        'Cada submissão cria um contacto na tua base de dados.',
        'Liga formulários a automações para dar seguimento imediato.',
      ],
    },
  },
  finances: {
    both: {
      title: 'Finanças',
      intro: 'O controlo financeiro do teu negócio.',
      bullets: [
        'Acompanha receitas e despesas por categoria.',
        'Vê a rentabilidade por cliente.',
        'Relatórios financeiros sempre actualizados.',
      ],
    },
  },
  vendas: {
    servicos: {
      title: 'Vendas',
      intro: 'Regista e acompanha as vendas dos teus serviços.',
      bullets: [
        'Emite faturas e recibos para os teus clientes.',
        'Acompanha o estado de cada venda.',
        'Tudo ligado aos contactos e processos.',
      ],
    },
    comercio: {
      title: 'Faturação',
      intro: 'Emite faturas e gere a faturação do teu comércio.',
      bullets: [
        'Cria faturas, recibos e notas de crédito.',
        'Configura séries e exporta SAF-T.',
        'Tudo em conformidade com a legislação angolana.',
      ],
    },
  },
  food: {
    food: {
      title: 'KukuGest Food',
      intro: 'A base operacional para restaurantes, cozinha e delivery.',
      bullets: [
        'Activa o módulo nas configurações para abrir o catálogo Food.',
        'Organiza unidades, categorias, produtos e complementos com dados reais.',
        'As próximas etapas ligam estes dados a pedidos, cozinha e delivery.',
      ],
    },
  },
  caixa: {
    comercio: {
      title: 'Caixa',
      intro: 'O teu ponto de venda e controlo de caixa.',
      bullets: [
        'Abre e fecha o caixa, registando o saldo inicial e final.',
        'Regista movimentos de entrada e saída de dinheiro.',
        'Acompanha o saldo em tempo real.',
      ],
    },
  },
  'vendas-rapidas': {
    comercio: {
      title: 'Venda Rápida',
      intro: 'Cobranças ágeis ao balcão.',
      bullets: [
        'Selecciona produtos e cobra em segundos.',
        'Emite recibo imediato ao cliente.',
        'Integra directamente com o caixa e o stock.',
      ],
    },
  },
  produtos: {
    comercio: {
      title: 'Produtos',
      intro: 'O catálogo de produtos do teu comércio.',
      bullets: [
        'Adiciona produtos com preço, categoria e nível de stock.',
        'O stock actualiza-se automaticamente a cada venda.',
        'Recebe alertas quando o stock está baixo.',
      ],
    },
  },
};

// Resolve o conteúdo final para um módulo e workspace. Devolve null se não houver.
export function resolveModuleIntro(
  moduleKey: IntroModuleKey,
  workspaceMode?: WorkspaceMode | string | null,
): ModuleIntroContent | null {
  const entry = CONTENT[moduleKey];
  if (!entry) return null;
  if ('both' in entry) return entry.both;
  const mode = workspaceMode === 'food' ? 'food' : workspaceMode === 'comercio' ? 'comercio' : 'servicos';
  return entry[mode] ?? entry.servicos ?? entry.comercio ?? entry.food ?? null;
}
