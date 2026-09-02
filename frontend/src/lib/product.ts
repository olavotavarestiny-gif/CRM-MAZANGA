export type AppProduct = 'crm' | 'food' | 'platform-admin' | 'growth-room';

const rawProduct = process.env.NEXT_PUBLIC_PRODUCT?.trim().toLowerCase();

export const APP_PRODUCT: AppProduct =
  rawProduct === 'food' || rawProduct === 'platform-admin' || rawProduct === 'growth-room' ? rawProduct : 'crm';

export const isFoodProduct = () => APP_PRODUCT === 'food';
export const isPlatformAdminProduct = () => APP_PRODUCT === 'platform-admin';
export const isGrowthRoomProduct = () => APP_PRODUCT === 'growth-room';

const FOOD_PUBLIC_TO_INTERNAL: Record<string, string> = {
  '/': '/food',
  '/ambientes': '/food',
  '/gestao': '/food/gestao',
  '/caixa': '/food/caixa',
  '/cozinha': '/food/cozinha',
  '/delivery': '/food/delivery',
  '/entregador': '/food/entregador',
  '/crm': '/food/crm',
  '/menu': '/food/produtos',
  '/configuracoes': '/food/configuracoes',
  '/ajuda': '/food/ajuda',
  '/pedidos': '/food/pedidos',
  '/novo-pedido': '/food/novo-pedido',
};

const FOOD_INTERNAL_TO_PUBLIC = Object.fromEntries(
  Object.entries(FOOD_PUBLIC_TO_INTERNAL).map(([publicPath, internalPath]) => [internalPath, publicPath])
);

export function toInternalFoodPath(pathname: string) {
  if (pathname === '/food' || pathname.startsWith('/food/')) return pathname;
  const exact = FOOD_PUBLIC_TO_INTERNAL[pathname];
  if (exact) return exact;
  const root = Object.keys(FOOD_PUBLIC_TO_INTERNAL)
    .filter((path) => path !== '/')
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname.startsWith(`${path}/`));
  return root ? `${FOOD_PUBLIC_TO_INTERNAL[root]}${pathname.slice(root.length)}` : pathname;
}

export function toPublicFoodPath(pathname: string) {
  if (!isFoodProduct()) return pathname;
  const exact = FOOD_INTERNAL_TO_PUBLIC[pathname];
  if (exact) return exact;
  const root = Object.keys(FOOD_INTERNAL_TO_PUBLIC)
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname.startsWith(`${path}/`));
  return root ? `${FOOD_INTERNAL_TO_PUBLIC[root]}${pathname.slice(root.length)}` : pathname;
}

export const productStorageKey = (key: string) => `kukugest:${APP_PRODUCT}:${key}`;
