import type { PlanCatalogEntry, PlanFeatureName, PlanName } from './api';

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

export function getPlanBillingOptions(plan: PlanName): string[] {
  if (plan === 'essencial') return ['Mensal', '6 meses', 'Anual'];
  if (plan === 'profissional') return ['6 meses', 'Anual'];
  return ['Personalizado'];
}

export function buildWhatsAppPlanLink({
  plan,
  billing,
  name,
  company,
}: {
  plan: PlanName;
  billing: string;
  name?: string | null;
  company?: string | null;
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

  const message = `${intro} Quero aderir ao plano ${plan.toUpperCase()} (${billing}) da KukuGest.`;
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
