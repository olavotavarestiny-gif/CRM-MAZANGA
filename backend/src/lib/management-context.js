const prisma = require('./prisma');

const MANAGEMENT_ROLES = ['admin', 'marketing', 'commercial', 'designer', 'editor'];
const MANAGEMENT_STAGES = [
  'lead_recebido', 'primeiro_contacto', 'lead_qualificado', 'reuniao_agendada',
  'reuniao_realizada', 'proposta_enviada', 'negociacao', 'ganho', 'perdido',
];

function isManagementWorkspace(user) {
  return user?.planContext?.workspaceMode === 'gestao_kpi';
}

function normalizeManagementRole(user) {
  if (user?.isAccountOwner || user?.role === 'admin') return 'admin';
  return MANAGEMENT_ROLES.includes(user?.role) ? user.role : null;
}

function requireManagementWorkspace(req, res, next) {
  if (!isManagementWorkspace(req.user)) {
    return res.status(403).json({ error: 'Esta funcionalidade pertence ao workspace Gestão e KPI.' });
  }
  next();
}

async function setContextValue(tx, key, value) {
  await tx.$queryRawUnsafe('SELECT set_config($1, $2, true)', key, String(value ?? ''));
}

async function provisionOwnerProfile(tx, requestUser) {
  const authUserId = requestUser.supabaseUid || null;
  const rows = await tx.$queryRawUnsafe(
    'SELECT * FROM provision_management_workspace($1::integer, $2, $3::uuid, $4)',
    requestUser.effectiveUserId,
    requestUser.name || 'Gestão e KPI',
    authUserId,
    requestUser.name || requestUser.email
  );
  return rows[0] || null;
}

async function withManagementContext(requestUser, callback) {
  if (!isManagementWorkspace(requestUser)) {
    const error = new Error('Workspace Gestão e KPI obrigatório.');
    error.statusCode = 403;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    await setContextValue(tx, 'app.management_user_id', requestUser.id);

    let profile = await tx.managementProfile.findUnique({ where: { userId: requestUser.id } });

    if (!profile && requestUser.isAccountOwner) {
      await provisionOwnerProfile(tx, requestUser);
      profile = await tx.managementProfile.findUnique({ where: { userId: requestUser.id } });
    }

    if (!profile || !profile.active) {
      const error = new Error('Perfil Gestão e KPI não encontrado ou inativo.');
      error.statusCode = 403;
      throw error;
    }

    const role = requestUser.isAccountOwner ? 'admin' : profile.role;
    await setContextValue(tx, 'app.management_organization_id', profile.organizationId);
    await setContextValue(tx, 'app.management_profile_id', profile.id);
    await setContextValue(tx, 'app.management_role', role);
    await setContextValue(tx, 'app.management_system', '');

    const organization = await tx.managementOrganization.findUnique({
      where: { id: profile.organizationId },
    });

    return callback(tx, {
      organizationId: profile.organizationId,
      profileId: profile.id,
      role,
      profile: { ...profile, organization },
    });
  }, { timeout: 20_000 });
}

function requireManagementRoles(context, roles) {
  if (!roles.includes(context.role)) {
    const error = new Error('Sem permissão para esta ação.');
    error.statusCode = 403;
    throw error;
  }
}

module.exports = {
  MANAGEMENT_ROLES,
  MANAGEMENT_STAGES,
  isManagementWorkspace,
  normalizeManagementRole,
  requireManagementWorkspace,
  requireManagementRoles,
  withManagementContext,
};
