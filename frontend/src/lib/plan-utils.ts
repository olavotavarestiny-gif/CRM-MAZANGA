import type { PlanCatalogEntry, PlanFeatureName, PlanName } from './api';
import type { WorkspaceMode } from './business-modes';

export type PricingTierKey = 'starter' | 'growth' | 'pro';
export type PricingSource =
  | 'landing'
  | 'crm'
  | 'settings'
  | 'blocked-feature'
  | 'hero'
  | 'workspace'
  | 'video'
  | 'workspace-services'
  | 'workspace-commerce'
  | 'pricing'
  | 'final-cta';

export interface PricingTier {
  key: PricingTierKey;
  internalPlan: PlanName;
  name: string;
  price: string;
  description: string;
  features: string[];
  buttonText: string;
  badge?: string;
  highlight?: boolean;
  emphasize?: boolean;
}

export interface PlanComparisonItem {
  feature: string;
  availabilityLabel: string;
  tone: 'growth' | 'pro' | 'soon';
}

export const PLAN_FEATURE_LABELS: Record<PlanFeatureName, string> = {
  painel: 'Painel',
  clientes: 'Clientes',
  processos: 'Processos',
  tarefas: 'Tarefas',
  vendas: 'Vendas',
  conversas: 'Conversas',
  calendario: 'Calendário',
  automacoes: 'Automações',
  formularios: 'Formulários',
  financas: 'Finanças',
};

const PLAN_TO_TIER: Record<PlanName, PricingTierKey> = {
  essencial: 'starter',
  profissional: 'growth',
  enterprise: 'pro',
};

const TIER_TO_PLAN: Record<PricingTierKey, PlanName> = {
  starter: 'essencial',
  growth: 'profissional',
  pro: 'enterprise',
};

const PLAN_ALIASES: Record<string, PlanName> = {
  inicial: 'essencial',
  crescimento: 'profissional',
  estabilidade: 'enterprise',
};

function normalizePlanInput(plan?: PlanName | string | null): PlanName | null {
  if (!plan) return null;
  const normalized = String(plan).trim().toLowerCase();
  if (normalized in PLAN_ALIASES) {
    return PLAN_ALIASES[normalized];
  }
  if (normalized === 'essencial' || normalized === 'profissional' || normalized === 'enterprise') {
    return normalized;
  }
  return null;
}

const WORKSPACE_PRICING_CATALOG: Record<WorkspaceMode, PricingTier[]> = {
  servicos: [
    {
      key: 'starter',
      internalPlan: 'essencial',
      name: 'Inicial',
      price: '9.999 Kz',
      description: 'Para quem está a começar a organizar o negócio',
      features: [
        '1 utilizador',
        'Até 500 contactos',
        'Contactos',
        'Tarefas',
        'Pipeline simples',
        'Faturação completa',
        'Painel básico',
      ],
      buttonText: 'Começar',
    },
    {
      key: 'growth',
      internalPlan: 'profissional',
      name: 'Crescimento',
      price: '29.999 Kz',
      description: 'Para empresas em crescimento que precisam de mais controlo',
      features: [
        'Até 5 utilizadores',
        'Até 5.000 contactos',
        'Tudo do Inicial',
        'Formulários',
        'Finanças',
        'Relatórios básicos',
        'Automações básicas',
      ],
      buttonText: 'Escolher Crescimento',
      badge: 'Mais escolhido',
      highlight: true,
    },
    {
      key: 'pro',
      internalPlan: 'enterprise',
      name: 'Estabilidade',
      price: '54.999 Kz',
      description: 'Para empresas estruturadas que querem crescer com mais inteligência',
      features: [
        'Utilizadores ilimitados',
        'Contactos ilimitados',
        'Tudo do Crescimento',
        'Relatórios avançados',
        'Automações completas',
        'Permissões avançadas',
        'Mensagens em massa (Em breve)',
      ],
      buttonText: 'Escolher Estabilidade',
      emphasize: true,
    },
  ],
  comercio: [
    {
      key: 'starter',
      internalPlan: 'essencial',
      name: 'Inicial',
      price: '9.999 Kz',
      description: 'Para pequenas lojas que precisam de vender com simplicidade',
      features: [
        '1 utilizador',
        'Até 300 clientes',
        'Vendas rápidas',
        'Produtos',
        'Clientes',
        'Faturação completa',
      ],
      buttonText: 'Começar',
    },
    {
      key: 'growth',
      internalPlan: 'profissional',
      name: 'Crescimento',
      price: '29.999 Kz',
      description: 'Para lojas em crescimento com mais movimento',
      features: [
        'Até 5 utilizadores',
        'Até 3.000 clientes',
        'Tudo do Inicial',
        'Caixa',
        'Stock',
        'Relatórios básicos',
      ],
      buttonText: 'Escolher Crescimento',
      badge: 'Mais escolhido',
      highlight: true,
    },
    {
      key: 'pro',
      internalPlan: 'enterprise',
      name: 'Estabilidade',
      price: '54.999 Kz',
      description: 'Para operações estruturadas com controlo total',
      features: [
        'Utilizadores ilimitados',
        'Clientes ilimitados',
        'Tudo do Crescimento',
        'Multi-estabelecimento',
        'Gestão de equipa',
        'Relatórios avançados',
        'Mensagens em massa (Em breve)',
      ],
      buttonText: 'Escolher Estabilidade',
      emphasize: true,
    },
  ],
};

const WORKSPACE_PLAN_COMPARISON: Record<WorkspaceMode, PlanComparisonItem[]> = {
  servicos: [
    { feature: 'Relatórios básicos', availabilityLabel: 'Crescimento e Estabilidade', tone: 'growth' },
    { feature: 'Relatórios avançados', availabilityLabel: 'Estabilidade', tone: 'pro' },
    { feature: 'Formulários', availabilityLabel: 'Crescimento e Estabilidade', tone: 'growth' },
    { feature: 'Automações básicas', availabilityLabel: 'Crescimento', tone: 'growth' },
    { feature: 'Automações completas', availabilityLabel: 'Estabilidade', tone: 'pro' },
    { feature: 'Mensagens em massa', availabilityLabel: 'Estabilidade (Em breve)', tone: 'soon' },
  ],
  comercio: [
    { feature: 'Caixa', availabilityLabel: 'Crescimento e Estabilidade', tone: 'growth' },
    { feature: 'Stock', availabilityLabel: 'Crescimento e Estabilidade', tone: 'growth' },
    { feature: 'Multi-estabelecimento', availabilityLabel: 'Estabilidade', tone: 'pro' },
    { feature: 'Relatórios avançados', availabilityLabel: 'Estabilidade', tone: 'pro' },
    { feature: 'Gestão de equipa', availabilityLabel: 'Crescimento e Estabilidade', tone: 'growth' },
    { feature: 'Mensagens em massa', availabilityLabel: 'Estabilidade (Em breve)', tone: 'soon' },
  ],
};

const WORKSPACE_UPGRADE_SUMMARY: Record<
  WorkspaceMode,
  Record<PricingTierKey, { title: string; description: string; bullets: string[] }>
> = {
  servicos: {
    starter: {
      title: 'Próximo passo recomendado: Crescimento',
      description: 'Desbloqueia o controlo operacional que normalmente começa a fazer falta quando o negócio deixa de estar numa fase inicial.',
      bullets: ['Formulários', 'Finanças', 'Relatórios básicos', 'Automações básicas predefinidas'],
    },
    growth: {
      title: 'Próximo passo: Estabilidade',
      description: 'Leva a operação para um nível mais estruturado, com análise e automação mais fortes.',
      bullets: ['Relatórios avançados', 'Automações completas', 'Permissões avançadas', 'Mensagens em massa (Em breve)'],
    },
    pro: {
      title: 'Está no plano mais completo',
      description: 'O plano Estabilidade já cobre a camada mais avançada do CRM para serviços.',
      bullets: ['Utilizadores ilimitados', 'Contactos ilimitados', 'Relatórios avançados', 'Permissões avançadas'],
    },
  },
  comercio: {
    starter: {
      title: 'Próximo passo recomendado: Crescimento',
      description: 'É a evolução natural para lojas que começam a ter mais volume diário e precisam de controlo operacional.',
      bullets: ['Caixa', 'Stock', 'Relatórios básicos', 'Até 5 utilizadores'],
    },
    growth: {
      title: 'Próximo passo: Estabilidade',
      description: 'Prepara a operação para escala, equipa e gestão multi-estabelecimento.',
      bullets: ['Multi-estabelecimento', 'Gestão de equipa', 'Relatórios avançados', 'Mensagens em massa (Em breve)'],
    },
    pro: {
      title: 'Está no plano mais completo',
      description: 'O plano Estabilidade cobre a operação comercial mais completa disponível hoje no KukuGest.',
      bullets: ['Clientes ilimitados', 'Multi-estabelecimento', 'Gestão de equipa', 'Relatórios avançados'],
    },
  },
};

export function getPlanBillingOptions(plan: PlanName): string[] {
  if (plan === 'essencial') return ['Mensal', '6 meses', 'Anual'];
  if (plan === 'profissional') return ['6 meses', 'Anual'];
  return ['Personalizado'];
}

export function getWorkspaceLabel(mode?: WorkspaceMode | string | null) {
  return mode === 'comercio' ? 'Comércio' : 'Serviços';
}

export function getPricingCatalog(mode: WorkspaceMode = 'servicos') {
  return WORKSPACE_PRICING_CATALOG[mode];
}

export function mapPlanNameToPricingTier(plan?: PlanName | string | null): PricingTierKey {
  const normalizedPlan = normalizePlanInput(plan);
  if (!normalizedPlan) return 'starter';
  return PLAN_TO_TIER[normalizedPlan] || 'starter';
}

export function getPlanFromPricingTier(tier: PricingTierKey): PlanName {
  return TIER_TO_PLAN[tier];
}

export function getPricingTierLabel(plan?: PlanName | null) {
  const tier = mapPlanNameToPricingTier(plan);
  return tier === 'starter' ? 'Inicial' : tier === 'growth' ? 'Crescimento' : 'Estabilidade';
}

export function getPricingTierDetails(
  workspaceMode: WorkspaceMode = 'servicos',
  plan?: PlanName | null
) {
  const tier = mapPlanNameToPricingTier(plan);
  return getPricingCatalog(workspaceMode).find((entry) => entry.key === tier) || getPricingCatalog(workspaceMode)[0];
}

export function getPricingTierStatusLabel(
  currentPlan?: PlanName | null,
  tier?: PricingTierKey
) {
  if (!tier || !currentPlan) return undefined;
  const currentTier = mapPlanNameToPricingTier(currentPlan);

  if (currentTier === 'pro' && tier === 'pro') {
    return 'Está no plano mais completo';
  }

  if (currentTier === tier) {
    return 'Plano atual';
  }

  if (currentTier === 'starter' && tier === 'growth') {
    return 'Recomendado para si';
  }

  if (currentTier === 'growth' && tier === 'pro') {
    return 'Próximo passo';
  }

  return undefined;
}

export function getUpgradeTargetPlan(plan?: PlanName | string | null): PlanName {
  const normalizedPlan = normalizePlanInput(plan);
  if (normalizedPlan === 'profissional') return 'enterprise';
  if (normalizedPlan === 'enterprise') return 'enterprise';
  return 'profissional';
}

export function getPricingButtonText(
  tier: PricingTier,
  source: PricingSource = 'landing',
  currentPlan?: PlanName | null
) {
  if (!currentPlan && (source === 'landing' || source === 'pricing')) {
    return 'Escolher plano no WhatsApp';
  }

  if (!currentPlan) return tier.buttonText;

  const currentTier = mapPlanNameToPricingTier(currentPlan);
  const order: PricingTierKey[] = ['starter', 'growth', 'pro'];
  const currentIndex = order.indexOf(currentTier);
  const tierIndex = order.indexOf(tier.key);

  if (tier.key === currentTier) {
    return 'Plano atual';
  }

  if (tierIndex > currentIndex) {
    return source === 'crm' || source === 'settings' ? tier.buttonText : 'Escolher plano no WhatsApp';
  }

  return 'Falar com a equipa';
}

export function getPlanComparisonItems(workspaceMode: WorkspaceMode = 'servicos') {
  return WORKSPACE_PLAN_COMPARISON[workspaceMode];
}

export function getUpgradeSummary(
  workspaceMode: WorkspaceMode = 'servicos',
  plan?: PlanName | null
) {
  const tier = mapPlanNameToPricingTier(plan);
  return WORKSPACE_UPGRADE_SUMMARY[workspaceMode][tier];
}

export function buildWhatsAppPlanLink({
  plan,
  billing,
  name,
  company,
  workspaceMode,
  source,
  visualPlanLabel,
  note,
}: {
  plan?: PlanName | string;
  billing?: string;
  name?: string | null;
  company?: string | null;
  workspaceMode?: WorkspaceMode | null;
  source?: PricingSource;
  visualPlanLabel?: string;
  note?: string;
}) {
  const base = 'https://wa.me/244942277576';
  const intro =
    name && company
      ? `Olá, sou ${name} da empresa ${company}.`
      : name
        ? `Olá, sou ${name}.`
        : company
          ? `Olá, falo da empresa ${company}.`
          : 'Olá,';

  const normalizedPlan = normalizePlanInput(plan);
  const planLabel =
    visualPlanLabel ||
    (normalizedPlan ? getPricingTierLabel(normalizedPlan) : (typeof plan === 'string' ? plan : 'Crescimento'));
  const workspaceLabel = workspaceMode ? ` para o workspace ${getWorkspaceLabel(workspaceMode)}` : '';
  const billingLabel = billing ? ` (${billing})` : '';
  const sourceLabel = source ? ` Origem: ${source}.` : '';
  const noteLabel = note ? ` ${note}` : '';

  const message = `${intro} Quero aderir ao plano ${planLabel}${workspaceLabel}${billingLabel} da KukuGest.${sourceLabel}${noteLabel}`.trim();
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppSupportLink({
  name,
  company,
}: {
  name?: string | null;
  company?: string | null;
} = {}) {
  const base = 'https://wa.me/244942277576';
  const intro =
    name && company
      ? `Olá, sou ${name} da empresa ${company}.`
      : name
        ? `Olá, sou ${name}.`
        : company
          ? `Olá, falo da empresa ${company}.`
          : 'Olá,';

  const message = `${intro} Preciso de ajuda com a KukuGest.`.trim();
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function formatLimitValue(limit: number | null | undefined) {
  return limit == null ? 'Ilimitado' : String(limit);
}

export function getPlanBadgeClasses(plan?: string | null) {
  if (plan === 'enterprise') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }
  if (plan === 'profissional') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

export function getSortedPlanEntries(availablePlans?: Partial<Record<PlanName, PlanCatalogEntry>>) {
  const order: PlanName[] = ['essencial', 'profissional', 'enterprise'];
  return order
    .map((plan) => [plan, availablePlans?.[plan] || null] as const)
    .filter(([, entry]) => !!entry) as Array<[PlanName, PlanCatalogEntry]>;
}

export function getBlockedFeatureCopy({
  featureName,
  pathname,
}: {
  featureName?: PlanFeatureName | 'advancedReports' | 'bulkMessages' | 'fullAutomations';
  pathname?: string;
}) {
  if (pathname?.startsWith('/caixa')) {
    return {
      title: 'Upgrade para o plano Crescimento',
      description: 'A área de caixa está disponível no plano Crescimento.',
      ctaLabel: 'Fazer upgrade',
    };
  }

  if (featureName === 'bulkMessages') {
    return {
      title: 'Disponível em breve no plano Estabilidade',
      description: 'Mensagens em massa disponíveis em breve no plano Estabilidade.',
      ctaLabel: 'Ver planos',
    };
  }

  if (featureName === 'advancedReports' || pathname?.startsWith('/relatorios')) {
    return {
      title: 'Upgrade para o plano Estabilidade',
      description: 'Os relatórios avançados estão disponíveis no plano Estabilidade.',
      ctaLabel: 'Fazer upgrade',
    };
  }

  if (featureName === 'fullAutomations') {
    return {
      title: 'Upgrade para o plano Estabilidade',
      description: 'As automações completas estão disponíveis no plano Estabilidade.',
      ctaLabel: 'Fazer upgrade',
    };
  }

  if (featureName === 'formularios') {
    return {
      title: 'Upgrade para o plano Crescimento',
      description: 'Os formulários estão disponíveis no plano Crescimento.',
      ctaLabel: 'Ver planos',
    };
  }

  if (featureName === 'financas') {
    return {
      title: 'Upgrade para o plano Crescimento',
      description: 'A área de finanças está disponível no plano Crescimento.',
      ctaLabel: 'Ver planos',
    };
  }

  if (featureName === 'automacoes' || pathname?.startsWith('/automations')) {
    return {
      title: 'Upgrade para o plano Crescimento',
      description: 'As automações básicas estão disponíveis no plano Crescimento.',
      ctaLabel: 'Ver planos',
    };
  }

  return {
    title: 'Upgrade para o plano Crescimento',
    description: 'Esta funcionalidade está disponível no plano Crescimento.',
    ctaLabel: 'Ver planos',
  };
}

export function getPlanLimitModalCopy({
  featureLabel,
  plan,
}: {
  featureLabel: string;
  plan: string;
}) {
  const normalizedLabel = featureLabel.toLowerCase();

  if (normalizedLabel.includes('relatório')) {
    return getBlockedFeatureCopy({ featureName: 'advancedReports' });
  }

  if (normalizedLabel.includes('formul')) {
    return getBlockedFeatureCopy({ featureName: 'formularios' });
  }

  if (normalizedLabel.includes('finan')) {
    return getBlockedFeatureCopy({ featureName: 'financas' });
  }

  if (normalizedLabel.includes('automa') && normalizedLabel.includes('complet')) {
    return getBlockedFeatureCopy({ featureName: 'fullAutomations' });
  }

  if (normalizedLabel.includes('automa')) {
    return getBlockedFeatureCopy({ featureName: 'automacoes' });
  }

  if (normalizedLabel.includes('massa')) {
    return getBlockedFeatureCopy({ featureName: 'bulkMessages' });
  }

  if (plan === 'enterprise') {
    return {
      title: 'Limite do plano atual',
      description: 'O plano Estabilidade é o mais completo. Fale com a equipa para um ajuste personalizado.',
      ctaLabel: 'Falar com a equipa',
    };
  }

  if (plan === 'profissional') {
    return {
      title: 'Upgrade disponível',
      description: 'Esta utilização pode exigir o plano Estabilidade para continuares sem limitações.',
      ctaLabel: 'Fazer upgrade',
    };
  }

  return {
    title: 'Upgrade disponível',
    description: 'Esta funcionalidade está disponível num plano superior do KukuGest.',
    ctaLabel: 'Ver planos',
  };
}
