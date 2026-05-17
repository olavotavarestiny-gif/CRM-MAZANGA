const { AsyncLocalStorage } = require('async_hooks');
const { ACCESS_ROLES } = require('./roles');

const DEV_AUTH_HEADER = 'x-kukugest-dev-auth';
const DEV_AUTH_TOKEN = 'kukugest-dev-auth-bypass-v1';
const DEV_AUTH_INTERNAL_USER_ID = -1001;
const devAuthRequestContext = new AsyncLocalStorage();

const DEV_AUTH_PUBLIC_USER = {
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
  workspaceMode: 'servicos',
  plan: 'enterprise',
  planDetails: {
    label: 'Enterprise',
    description: 'Modo local de desenvolvimento',
  },
  planLimits: {
    contacts: null,
    users: null,
    tasks: null,
    automations: null,
  },
  planFeatures: {
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
  },
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
  isDevAuthBypass: true,
};

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true';
}

function hasValidDevAuthHeader(req) {
  return req.headers[DEV_AUTH_HEADER] === DEV_AUTH_TOKEN;
}

function buildDevAuthRequestUser() {
  return {
    id: DEV_AUTH_INTERNAL_USER_ID,
    email: DEV_AUTH_PUBLIC_USER.email,
    name: DEV_AUTH_PUBLIC_USER.name,
    role: DEV_AUTH_PUBLIC_USER.role,
    accessRole: DEV_AUTH_PUBLIC_USER.accessRole,
    isSuperAdmin: false,
    permissionsJson: null,
    accountOwnerId: null,
    supabaseUid: null,
    effectiveUserId: DEV_AUTH_INTERNAL_USER_ID,
    isAccountOwner: true,
    mustChangePassword: false,
    impersonatedBy: null,
    isDevAuthBypass: true,
  };
}

function isDevAuthWrite(req) {
  return req.user?.isDevAuthBypass === true && WRITE_METHODS.has(req.method);
}

function runWithDevAuthBypass(callback) {
  return devAuthRequestContext.run({ isDevAuthBypass: true }, callback);
}

function isDevAuthRequestContext() {
  return devAuthRequestContext.getStore()?.isDevAuthBypass === true;
}

module.exports = {
  DEV_AUTH_HEADER,
  DEV_AUTH_TOKEN,
  DEV_AUTH_PUBLIC_USER,
  isDevAuthBypassEnabled,
  hasValidDevAuthHeader,
  buildDevAuthRequestUser,
  isDevAuthWrite,
  runWithDevAuthBypass,
  isDevAuthRequestContext,
};
