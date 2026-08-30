import guide from './food-guide.json';

export type FoodGuideRoleId = 'manager' | 'cashier' | 'kitchen' | 'delivery_manager' | 'courier' | 'crm_marketing';

export interface FoodGuideStep {
  title: string;
  description: string;
}

export interface FoodGuideTopic {
  id: string;
  section: string;
  title: string;
  summary: string;
  route: string;
  roles: FoodGuideRoleId[];
  outcome: string;
  steps: FoodGuideStep[];
  tips: string[];
  warnings: string[];
}

export interface FoodGuideContent {
  version: string;
  updatedAt: string;
  title: string;
  description: string;
  roles: Array<{ id: FoodGuideRoleId; label: string; description: string }>;
  flow: string[];
  topics: FoodGuideTopic[];
}

export const foodGuide = guide as FoodGuideContent;

export const foodGuideRoleLabels = Object.fromEntries(
  foodGuide.roles.map((role) => [role.id, role.label]),
) as Record<FoodGuideRoleId, string>;

type SearchParamReader = { get(name: string): string | null };

const topicById = new Map(foodGuide.topics.map((topic) => [topic.id, topic]));

function topic(id: string) {
  return topicById.get(id) ?? null;
}

export function resolveFoodGuideTopic(
  pathname: string,
  searchParams: SearchParamReader,
): FoodGuideTopic | null {
  if (pathname === '/food/ajuda' || pathname.startsWith('/food/ajuda/')) return null;
  if (pathname === '/food/configuracoes') {
    const section = searchParams.get('section') || 'identity';
    return topic({
      identity: 'identity-operation',
      operation: 'operation-settings',
      orders: 'order-settings',
      locations: 'locations',
      team: 'team',
    }[section] || 'identity-operation');
  }
  if (pathname === '/food/produtos') {
    return topic(`menu-${searchParams.get('tab') || 'products'}`) || topic('menu-products');
  }
  if (pathname === '/food/crm') {
    return topic(`crm-${searchParams.get('tab') || 'customers'}`) || topic('crm-customers');
  }
  if (pathname === '/food/pedidos') {
    return topic(`orders-${searchParams.get('tab') || 'active'}`) || topic('orders-active');
  }

  const exactTopics: Record<string, string> = {
    '/food': 'workspace',
    '/food/gestao': 'management-overview',
    '/food/gestao/stock': 'stock',
    '/food/gestao/fichas': 'recipes',
    '/food/gestao/compras': 'purchases',
    '/food/gestao/equipa': 'workforce',
    '/food/gestao/relatorios': 'reports',
    '/food/novo-pedido': 'new-order',
    '/food/caixa': 'cashier',
    '/food/cozinha': 'kitchen',
    '/food/delivery': 'delivery',
    '/food/entregador': 'courier',
  };
  return topic(exactTopics[pathname]);
}
