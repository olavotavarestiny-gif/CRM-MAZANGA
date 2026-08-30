import { ACCESS_ROLES } from './roles';

export const DEV_AUTH_SESSION_KEY = 'kukugest:dev-auth-user';
export const DEV_AUTH_HEADER = 'x-kukugest-dev-auth';
export const DEV_AUTH_PERSON_HEADER = 'x-kukugest-dev-person-id';
export const DEV_AUTH_TOKEN = 'kukugest-dev-auth-bypass-v1';
export const DEV_AUTH_PERSON_STORAGE_KEY = 'kukugest:dev-auth-person-id';
const DEV_AUTH_WORKSPACE_MODE = process.env.NEXT_PUBLIC_DEV_AUTH_WORKSPACE_MODE === 'gestao_kpi'
  ? 'gestao_kpi'
  : process.env.NEXT_PUBLIC_DEV_AUTH_WORKSPACE_MODE === 'food'
    ? 'food'
  : process.env.NEXT_PUBLIC_DEV_AUTH_WORKSPACE_MODE === 'comercio'
    ? 'comercio'
    : 'servicos';

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
  food: true,
};

const DEV_PLAN_LIMITS = {
  contacts: null,
  users: null,
  tasks: null,
  automations: null,
};

export const DEV_AUTH_USER = {
  id: 'dev-user-local-001',
  name: 'Dev Tester',
  email: 'dev@local.test',
  role: 'OrgAdmin',
  accessRole: ACCESS_ROLES.ORG_ADMIN,
  orgId: 'dev-org-local-001',
  orgName: 'Dev Org Local',
  active: true,
  accountOwnerId: null,
  accountOwnerName: 'Dev Org Local',
  isSuperAdmin: false,
  permissions: null,
  mustChangePassword: false,
  workspaceMode: DEV_AUTH_WORKSPACE_MODE,
  defaultWorkspace: DEV_AUTH_WORKSPACE_MODE,
  availableWorkspaces: DEV_AUTH_WORKSPACE_MODE === 'food'
    ? ['servicos', 'food']
    : [DEV_AUTH_WORKSPACE_MODE, 'food'],
  foodAccess: {
    entitled: true,
    enabled: true,
    roles: ['manager'],
    primaryRole: 'manager',
    branchIds: null,
    branches: [],
    permissions: ['*'],
    roleLabels: {
      manager: 'Gestor',
      cashier: 'Caixa',
      kitchen: 'Cozinha',
      delivery_manager: 'Gestor de Delivery',
      courier: 'Entregador',
      crm_marketing: 'CRM & Marketing',
    },
  },
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
  return (process.env.NODE_ENV || 'development') === 'development' && process.env.BYPASS_AUTH === 'true';
}

export function isClientDevAuthBypassEnabled() {
  return process.env.NODE_ENV === 'development' && Boolean(process.env.NEXT_PUBLIC_DEV_AUTH_WORKSPACE_MODE);
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

export function getDevAuthPersonId(): number | null {
  if (typeof window === 'undefined') return null;
  const value = Number(localStorage.getItem(DEV_AUTH_PERSON_STORAGE_KEY));
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function setDevAuthPersonId(personId: number | null) {
  if (typeof window === 'undefined') return;
  if (personId === null) localStorage.removeItem(DEV_AUTH_PERSON_STORAGE_KEY);
  else localStorage.setItem(DEV_AUTH_PERSON_STORAGE_KEY, String(personId));
}
