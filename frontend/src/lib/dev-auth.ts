import { ACCESS_ROLES } from './roles';

export const DEV_AUTH_SESSION_KEY = 'kukugest:dev-auth-user';
export const DEV_AUTH_HEADER = 'x-kukugest-dev-auth';
export const DEV_AUTH_TOKEN = 'kukugest-dev-auth-bypass-v1';

const DEV_PLAN_FEATURES = {
  painel: true,
  clientes: true,
  processos: true,
  tarefas: true,
  vendas: true,
  conversas: true,
  calendario: true,
  automacoes: true,
  formularios: true,
  financas: true,
};

const DEV_PLAN_LIMITS = {
  contacts: null,
  users: null,
  tasks: null,
  automations: null,
};

// Modo de workspace da conta de demonstração local.
// Define NEXT_PUBLIC_DEV_WORKSPACE_MODE=comercio para capturar os ecrãs de
// Caixa/POS, Produtos e Faturação; o valor por omissão ('servicos') mostra o
// CRM completo (pipeline, conversas, automações, formulários).
const DEV_WORKSPACE_MODE: 'servicos' | 'comercio' =
  process.env.NEXT_PUBLIC_DEV_WORKSPACE_MODE === 'comercio' ? 'comercio' : 'servicos';

export const DEV_AUTH_USER = {
  id: 'dev-user-local-001',
  name: 'Carla Mendes',
  email: 'carla@mazanga.ao',
  role: 'OrgAdmin',
  accessRole: ACCESS_ROLES.ORG_ADMIN,
  orgId: 'dev-org-local-001',
  orgName: 'Mazanga Soluções',
  active: true,
  accountOwnerId: null,
  accountOwnerName: 'Mazanga Soluções',
  isSuperAdmin: false,
  permissions: null,
  mustChangePassword: false,
  workspaceMode: DEV_WORKSPACE_MODE,
  plan: 'enterprise',
  planDetails: {
    label: 'Enterprise',
    description: 'Modo local de desenvolvimento',
  },
  planLimits: DEV_PLAN_LIMITS,
  planFeatures: DEV_PLAN_FEATURES,
  availablePlans: {},
  billingType: 'trial',
  trialEndsAt: null,
  expiresAt: null,
  graceEndsAt: null,
  accountStatus: 'active',
  subscription: {
    billingType: 'trial',
    accountStatus: 'active',
    readOnly: false,
    message: null,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLogin: undefined,
  isDevAuthBypass: true,
} as const;

export function isServerDevAuthBypassEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true';
}

export function isDevAuthUserPayload(payload: unknown) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      (payload as { isDevAuthBypass?: unknown }).isDevAuthBypass === true
  );
}

export function writeDevAuthSession(payload: unknown = DEV_AUTH_USER) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DEV_AUTH_SESSION_KEY, JSON.stringify(payload));
}

export function clearDevAuthSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DEV_AUTH_SESSION_KEY);
}

export function isDevAuthSessionActive() {
  if (typeof window === 'undefined') return false;
  return Boolean(sessionStorage.getItem(DEV_AUTH_SESSION_KEY));
}
