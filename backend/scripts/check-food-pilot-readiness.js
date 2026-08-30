'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function assertLocalDatabase() {
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  const database = databaseUrl.pathname.slice(1);
  const localHost = ['127.0.0.1', 'localhost'].includes(databaseUrl.hostname);
  if (!localHost || !['kukugest_dev', 'kukugest_test'].includes(database)) {
    throw new Error('O preflight do piloto só pode consultar kukugest_dev ou kukugest_test em localhost.');
  }
  return database;
}

function selectedOrganizationWhere() {
  const id = Number(process.env.FOOD_PILOT_ORG_ID);
  const email = String(process.env.FOOD_PILOT_ORG_EMAIL || '').trim().toLowerCase();
  if (Number.isInteger(id) && id > 0) return { id };
  if (email) return { email };
  throw new Error('Defina FOOD_PILOT_ORG_ID ou FOOD_PILOT_ORG_EMAIL para escolher explicitamente a organização.');
}

function resultItem(key, status, summary, details = {}) {
  return { key, status, summary, ...details };
}

async function main() {
  const database = assertLocalDatabase();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const checks = [];

  try {
    const organization = await prisma.user.findUnique({
      where: selectedOrganizationWhere(),
      select: { id: true, name: true, email: true, active: true, workspaceMode: true },
    });
    if (!organization) throw new Error('Organização piloto não encontrada na base local.');

    const [module, settings, branches] = await Promise.all([
      prisma.organizationModule.findUnique({
        where: { organizationId_module: { organizationId: organization.id, module: 'food' } },
        select: { enabled: true, planTier: true },
      }),
      prisma.foodSettings.findUnique({
        where: { userId: organization.id },
        select: { isEnabled: true, restaurantName: true, logoUrl: true, currency: true, timezone: true },
      }),
      prisma.foodBranch.findMany({
        where: { userId: organization.id, active: true },
        select: { id: true, name: true, isMain: true, estabelecimentoId: true },
        orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      }),
    ]);

    checks.push(resultItem('organization_active', organization.active ? 'pass' : 'block',
      organization.active ? 'Organização activa.' : 'A organização está desactivada.'));
    checks.push(resultItem('food_module', module?.enabled ? 'pass' : 'block',
      module?.enabled ? 'Módulo Food incluído na organização.' : 'Módulo Food ausente ou desactivado.'));
    checks.push(resultItem('food_enabled', settings?.isEnabled ? 'pass' : 'block',
      settings?.isEnabled ? 'Food activado nas configurações.' : 'FoodSettings.isEnabled está desactivado.'));

    const requestedBranchId = String(process.env.FOOD_PILOT_BRANCH_ID || '').trim();
    let branch = requestedBranchId ? branches.find((candidate) => candidate.id === requestedBranchId) : null;
    if (!branch && !requestedBranchId && branches.length === 1) branch = branches[0];
    const diagnosticBranch = branch
      || branches.find((candidate) => candidate.isMain)
      || branches[0]
      || null;
    if (!branches.length) {
      checks.push(resultItem('pilot_branch', 'block', 'Não existe unidade Food activa.'));
    } else if (requestedBranchId && !branch) {
      checks.push(resultItem('pilot_branch', 'block', 'FOOD_PILOT_BRANCH_ID não pertence à organização ou está inactiva.'));
    } else if (!requestedBranchId && branches.length > 1) {
      checks.push(resultItem('pilot_branch_selection', 'block', 'Existem várias unidades; defina FOOD_PILOT_BRANCH_ID explicitamente.', {
        availableBranches: branches.map(({ id, name, isMain }) => ({ id, name, isMain })),
      }));
    }
    if (branch) checks.push(resultItem('pilot_branch', 'pass', `Unidade piloto seleccionada: ${branch.name}.`, { branchId: branch.id }));

    const branchId = diagnosticBranch?.id || '__missing_branch__';
    const branchScope = { OR: [{ branchId: null }, { branchId }] };
    const openPurchaseStates = ['draft', 'awaiting_confirmation', 'confirmed', 'in_delivery', 'partial'];
    const openCollectionStates = ['pending_collection', 'with_courier', 'handed_to_cashier', 'not_received', 'discrepancy'];
    const [assignments, credentials, categories, products, ingredients, recipes, openOrders, openTickets,
      openDeliveries, openCashSessions, openShifts, openCollections, openPurchases] = await Promise.all([
      prisma.foodStaffRoleAssignment.findMany({
        where: { organizationId: organization.id, active: true, ...branchScope, person: { active: true } },
        select: { personId: true, role: true, branchId: true, person: { select: { name: true } } },
      }),
      prisma.foodStaffCredential.findMany({
        where: { organizationId: organization.id, active: true },
        select: { personId: true },
      }),
      prisma.foodCategory.count({ where: { userId: organization.id, active: true } }),
      prisma.foodProduct.count({
        where: { userId: organization.id, active: true, available: true, OR: [{ branchId: null }, { branchId }] },
      }),
      prisma.foodIngredient.count({
        where: { organizationId: organization.id, active: true, OR: [{ branchId: null }, { branchId }] },
      }),
      prisma.foodRecipeItem.count({
        where: { organizationId: organization.id, product: { active: true, OR: [{ branchId: null }, { branchId }] } },
      }),
      prisma.foodOrder.count({
        where: { userId: organization.id, branchId, orderState: { in: ['draft', 'active'] } },
      }),
      prisma.foodKitchenTicket.count({
        where: { userId: organization.id, branchId, state: { in: ['queued', 'accepted', 'preparing', 'ready'] } },
      }),
      prisma.foodDelivery.count({
        where: { userId: organization.id, branchId, state: { notIn: ['delivered', 'returned'] } },
      }),
      prisma.foodCashSession.count({ where: { organizationId: organization.id, branchId, status: 'open' } }),
      prisma.foodShift.count({ where: { organizationId: organization.id, branchId, status: 'open' } }),
      prisma.foodDeliveryCollection.count({
        where: { organizationId: organization.id, branchId, state: { in: openCollectionStates } },
      }),
      prisma.foodPurchase.count({
        where: { organizationId: organization.id, branchId, status: { in: openPurchaseStates } },
      }),
    ]);

    const requiredRoles = ['cashier', 'kitchen', 'delivery_manager', 'courier', 'crm_marketing'];
    const roles = Object.fromEntries(requiredRoles.map((role) => [role, assignments.filter((item) => item.role === role).length]));
    const missingRoles = requiredRoles.filter((role) => roles[role] === 0);
    checks.push(resultItem('food_roles', missingRoles.length ? 'block' : 'pass',
      missingRoles.length ? `Faltam funções: ${missingRoles.join(', ')}.` : 'As cinco funções delegadas estão atribuídas; o dono assume Gestor.',
      { roles }));

    const credentialPersonIds = new Set(credentials.map((credential) => credential.personId));
    const credentialCandidates = assignments.filter((assignment) => ['cashier', 'kitchen', 'delivery_manager', 'courier'].includes(assignment.role));
    const missingCredentials = credentialCandidates.filter((assignment) => !credentialPersonIds.has(assignment.personId));
    checks.push(resultItem('staff_credentials', missingCredentials.length ? 'block' : 'pass',
      missingCredentials.length ? 'Existem operadores sem código pessoal configurado.' : 'Operadores possuem credencial Food activa.', {
        missing: missingCredentials.map((assignment) => ({ personId: assignment.personId, name: assignment.person.name, role: assignment.role })),
      }));

    checks.push(resultItem('catalog', categories > 0 && products > 0 ? 'pass' : 'block',
      categories > 0 && products > 0 ? `${categories} categoria(s) e ${products} produto(s) disponíveis.` : 'A unidade precisa de categoria e produto disponível.',
      { categories, availableProducts: products }));
    checks.push(resultItem('stock_foundation', ingredients > 0 && recipes > 0 ? 'pass' : 'warn',
      ingredients > 0 && recipes > 0 ? `${ingredients} ingrediente(s) e ${recipes} linha(s) de ficha técnica.` : 'Stock/fichas técnicas incompletos; executar cenários de stock apenas depois da configuração.',
      { ingredients, recipeItems: recipes }));

    const pending = { openOrders, openTickets, openDeliveries, openCashSessions, openShifts, openCollections, openPurchases };
    const pendingTotal = Object.values(pending).reduce((sum, value) => sum + value, 0);
    checks.push(resultItem('clean_operational_baseline', pendingTotal ? 'block' : 'pass',
      pendingTotal ? 'Existem operações abertas; encerrar ou documentar antes da sessão.' : 'Não existem operações abertas na unidade piloto.', pending));

    checks.push(resultItem('brand', settings?.restaurantName && settings?.logoUrl ? 'pass' : 'warn',
      settings?.restaurantName && settings?.logoUrl ? 'Nome e logótipo configurados.' : 'Nome ou logótipo ainda não está configurado.'));
    checks.push(resultItem('fiscal_link', diagnosticBranch?.estabelecimentoId ? 'pass' : 'warn',
      diagnosticBranch?.estabelecimentoId ? 'Unidade ligada a um estabelecimento fiscal.' : 'Sem sede fiscal ligada; isto não bloqueia o piloto operacional.'));
    checks.push(resultItem('private_delivery_media', process.env.BLOB_READ_WRITE_TOKEN ? 'pass' : 'warn',
      process.env.BLOB_READ_WRITE_TOKEN ? 'Armazenamento privado configurado.' : 'Sem armazenamento privado; usar PIN em pedidos pagos e adiar prova fotográfica.'));

    const blockers = checks.filter((check) => check.status === 'block');
    const warnings = checks.filter((check) => check.status === 'warn');
    const output = {
      ready: blockers.length === 0,
      generatedAt: new Date().toISOString(),
      environment: { database, localOnly: true, readOnly: true },
      organization,
      selectedBranch: branch || null,
      diagnosticBranch: branch ? null : diagnosticBranch,
      settings: settings ? {
        restaurantName: settings.restaurantName,
        currency: settings.currency,
        timezone: settings.timezone,
      } : null,
      checks,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      nextStep: blockers.length
        ? 'Resolver os bloqueios e repetir npm run pilot:food:preflight.'
        : 'Preflight aprovado; preencher e executar docs/food-pilot-materia-preta-acceptance.md.',
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (blockers.length) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[food-pilot-preflight]', error.message);
  process.exitCode = 1;
});
