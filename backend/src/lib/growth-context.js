const prisma = require('./prisma');

function growthAdminEmails() {
  return new Set(String(process.env.GROWTH_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || 'olavo@kukugest.ao')
    .split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function setContext(tx, key, value) {
  await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', key, String(value ?? ''));
}

async function withGrowthContext(requestUser, callback) {
  return prisma.$transaction(async (tx) => {
    await setContext(tx, 'app.growth_user_id', requestUser.id);
    await setContext(tx, 'app.growth_system', '');

    let membership = await tx.growthMembership.findFirst({ where: { userId: requestUser.id, active: true } });
    let clientAccess = null;

    if (!membership) {
      clientAccess = await tx.growthClientAccess.findFirst({ where: { userId: requestUser.id, active: true } });
    }

    if (!membership && !clientAccess && (requestUser.isSuperAdmin || requestUser.isDevAuthLocalUser || growthAdminEmails().has(String(requestUser.email).toLowerCase()))) {
      await setContext(tx, 'app.growth_system', 'provision');
      const organization = await tx.growthOrganization.upsert({
        where: { accountOwnerId: requestUser.id },
        update: { name: process.env.GROWTH_ORGANIZATION_NAME || 'Mazanga Marketing' },
        create: { accountOwnerId: requestUser.id, name: process.env.GROWTH_ORGANIZATION_NAME || 'Mazanga Marketing' },
      });
      membership = await tx.growthMembership.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: requestUser.id } },
        update: { active: true, role: 'mazanga_admin' },
        create: { organizationId: organization.id, userId: requestUser.id, role: 'mazanga_admin' },
      });
      await setContext(tx, 'app.growth_system', '');
    }

    if (!membership && !clientAccess) {
      const error = new Error('Não tens acesso à Mazanga Growth Room.');
      error.statusCode = 403;
      throw error;
    }

    if (membership) {
      await setContext(tx, 'app.growth_organization_id', membership.organizationId);
      membership.organization = await tx.growthOrganization.findUnique({ where: { id: membership.organizationId } });
    } else {
      await setContext(tx, 'app.growth_client_id', clientAccess.clientId);
      clientAccess.client = await tx.growthClient.findUnique({ where: { id: clientAccess.clientId } });
    }

    const context = membership
      ? { role: 'mazanga_admin', organizationId: membership.organizationId, clientId: null, membership }
      : { role: 'client', organizationId: clientAccess.client.organizationId, clientId: clientAccess.clientId, clientAccess };

    await setContext(tx, 'app.growth_organization_id', context.organizationId);
    await setContext(tx, 'app.growth_client_id', context.clientId);
    await setContext(tx, 'app.growth_role', context.role);
    return callback(tx, context);
  }, { timeout: 20_000 });
}

function requireGrowthAdmin(context) {
  if (context.role !== 'mazanga_admin') {
    const error = new Error('Esta ação está reservada à equipa Mazanga.');
    error.statusCode = 403;
    throw error;
  }
}

module.exports = { withGrowthContext, requireGrowthAdmin };
